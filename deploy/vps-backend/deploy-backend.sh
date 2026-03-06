#!/usr/bin/env bash
# =============================================================================
# Lucky Draw — Node.js Backend VPS deployment script
# Installs Node.js 20, PM2, clones/updates the repo, wires the .env,
# and starts the backend as a managed PM2 process.
#
# Usage:
#   chmod +x deploy-backend.sh
#   sudo ./deploy-backend.sh
#
# Re-running the script is safe (idempotent — restarts the process if running).
# =============================================================================

set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Root check ────────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  error "This script must be run as root.  Try: sudo ./deploy-backend.sh"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="/opt/lucky-draw/backend"
ENV_FILE="$APP_DIR/.env"

echo ""
echo -e "${BOLD}============================================================${NC}"
echo -e "${BOLD}  Lucky Draw — Backend VPS Deployment${NC}"
echo -e "${BOLD}============================================================${NC}"
echo ""

# ── 1. Require .env to exist (created by the operator before running) ─────────
if [[ ! -f "$SCRIPT_DIR/.env" ]]; then
  if [[ ! -f "$SCRIPT_DIR/.env.example" ]]; then
    error ".env.example not found. Ensure you cloned the repository."
  fi
  cp "$SCRIPT_DIR/.env.example" "$ENV_FILE_TEMPLATE"
  warn ".env not found."
  warn "Copy $SCRIPT_DIR/.env.example to $SCRIPT_DIR/.env, fill in all values, then re-run."
  exit 1
fi

# Source for validation
set -a; source "$SCRIPT_DIR/.env"; set +a

# Validate required variables
[[ -z "${DATABASE_URL:-}" ]]   && error "DATABASE_URL is not set in .env"
[[ -z "${JWT_SECRET:-}" ]]     && error "JWT_SECRET is not set in .env"
[[ "${JWT_SECRET:-}" == "change_this_to_a_long_random_secret_in_production" ]] \
  && error "JWT_SECRET must be changed from the default value."
[[ -z "${FRONTEND_URL:-}" ]]   && error "FRONTEND_URL is not set in .env (your Vercel URL)"

success ".env validated."

# ── 2. Install Node.js 20 if missing ─────────────────────────────────────────
if ! command -v node &>/dev/null || [[ "$(node -e 'process.stdout.write(process.version.split(".")[0].replace("v",""))')" -lt 20 ]]; then
  info "Installing Node.js 20..."
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y -qq nodejs
  success "Node.js $(node --version) installed."
else
  success "Node.js $(node --version) already installed."
fi

# ── 3. Install PM2 globally ───────────────────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
  info "Installing PM2..."
  npm install -g pm2 --silent
  success "PM2 $(pm2 --version) installed."
else
  success "PM2 $(pm2 --version) already installed."
fi

# ── 4. Copy backend source to /opt/lucky-draw/backend ────────────────────────
info "Deploying backend source to $APP_DIR..."
mkdir -p "$APP_DIR"

# Rsync from the repo's backend directory (two levels up from deploy/vps-backend)
REPO_BACKEND="$(realpath "$SCRIPT_DIR/../../backend")"
if [[ ! -d "$REPO_BACKEND/src" ]]; then
  error "Could not find backend source at $REPO_BACKEND. Run this script from deploy/vps-backend/ inside the cloned repo."
fi

rsync -a --delete \
  --exclude=node_modules \
  --exclude=.env \
  "$REPO_BACKEND/" "$APP_DIR/"

success "Source files copied."

# ── 5. Write .env into the app directory ─────────────────────────────────────
cp "$SCRIPT_DIR/.env" "$ENV_FILE"
chmod 600 "$ENV_FILE"
success ".env written to $ENV_FILE"

# ── 6. Install npm dependencies ───────────────────────────────────────────────
info "Installing npm dependencies..."
cd "$APP_DIR"
npm install --omit=dev --silent
success "Dependencies installed."

# ── 7. Start / restart with PM2 ──────────────────────────────────────────────
info "Starting backend with PM2..."
if pm2 describe lucky-draw-api &>/dev/null; then
  pm2 restart lucky-draw-api --update-env
  success "PM2 process restarted."
else
  pm2 start src/index.js \
    --name lucky-draw-api \
    --restart-delay 3000 \
    --max-restarts 10 \
    --env production
  success "PM2 process started."
fi

# Persist across reboots
pm2 save --force
# Register startup hook (only needed once, but safe to repeat)
PM2_STARTUP=$(pm2 startup systemd -u root --hp /root 2>&1 | grep "sudo env" || true)
if [[ -n "$PM2_STARTUP" ]]; then
  eval "$PM2_STARTUP" || true
fi

# ── 8. Install NGINX as HTTPS reverse proxy ───────────────────────────────────
DOMAIN="${BACKEND_DOMAIN:-}"
# Let's Encrypt never issues certificates for bare IP addresses — detect and skip early
IP_REGEX='^([0-9]{1,3}\.){3}[0-9]{1,3}$'
if [[ -z "$DOMAIN" ]]; then
  warn "BACKEND_DOMAIN not set in .env — skipping NGINX / Certbot setup."
  warn "Set BACKEND_DOMAIN=api.yourdomain.com in .env and re-run to enable HTTPS."
elif [[ "$DOMAIN" =~ $IP_REGEX ]]; then
  warn "BACKEND_DOMAIN='$DOMAIN' is an IP address — skipping NGINX / Certbot setup."
  warn "Let's Encrypt does not issue TLS certificates for bare IP addresses."
  warn "Options for HTTPS without a domain:"
  warn "  1) Cloudflare Tunnel: cloudflared tunnel --url http://localhost:${PORT:-4000}"
  warn "  2) Get a domain, set BACKEND_DOMAIN=api.yourdomain.com, and re-run this script."
  DOMAIN=""
else
  if ! command -v nginx &>/dev/null; then
    info "Installing NGINX..."
    apt-get install -y -qq nginx
  fi
  if ! command -v certbot &>/dev/null; then
    info "Installing Certbot..."
    apt-get install -y -qq certbot python3-certbot-nginx
  fi

  NGINX_CONF="/etc/nginx/sites-available/lucky-draw-api"
  cat > "$NGINX_CONF" <<NGINX
server {
    listen 80;
    server_name ${DOMAIN};

    # Required for Socket.io WebSocket upgrade
    location / {
        proxy_pass         http://127.0.0.1:${PORT:-4000};
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        client_max_body_size 10M;
    }
}
NGINX

  ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/lucky-draw-api
  nginx -t && systemctl reload nginx
  success "NGINX configured for $DOMAIN"

  info "Requesting TLS certificate from Let's Encrypt..."
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
    -m "${CERTBOT_EMAIL:-admin@${DOMAIN}}" --redirect || \
    warn "Certbot failed. Ensure DNS for $DOMAIN points to this server before running again."
fi

# ── 9. Print summary ──────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}============================================================${NC}"
echo -e "${GREEN}  Backend deployment complete!${NC}"
echo -e "${BOLD}============================================================${NC}"
echo ""
pm2 list
echo ""
echo -e "${BOLD}  Useful commands:${NC}"
echo "  pm2 logs lucky-draw-api          # stream live logs"
echo "  pm2 status                        # process status"
echo "  pm2 restart lucky-draw-api        # restart"
echo "  sudo ./deploy-backend.sh          # re-deploy after code changes"
echo ""
if [[ -n "${DOMAIN:-}" ]]; then
  echo -e "${YELLOW}  Set this in your Vercel environment variables:${NC}"
  echo -e "  ${CYAN}VITE_API_URL=https://${DOMAIN}${NC}"
else
  PORT_VAL="${PORT:-4000}"
  VPS_IP=$(curl -s ifconfig.me 2>/dev/null || echo "<your-vps-ip>")
  echo -e "${YELLOW}  Set this in your Vercel environment variables:${NC}"
  echo -e "  ${CYAN}VITE_API_URL=http://${VPS_IP}:${PORT_VAL}${NC}"
  echo -e "  ${YELLOW}(Add BACKEND_DOMAIN to .env and re-run to get HTTPS instead)${NC}"
fi
echo ""
