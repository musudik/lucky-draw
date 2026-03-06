#!/usr/bin/env bash
# =============================================================================
# Lucky Draw — PostgreSQL VPS deployment script
# Provisions a PostgreSQL 15 Docker container bound to 127.0.0.1 only,
# sets up a daily backup cron job, and prints the DATABASE_URL for use
# in the backend .env.
#
# Usage:
#   chmod +x deploy.sh
#   sudo ./deploy.sh
#
# Re-running the script is safe (idempotent).
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
  error "This script must be run as root.  Try: sudo ./deploy.sh"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo -e "${BOLD}============================================================${NC}"
echo -e "${BOLD}  Lucky Draw — PostgreSQL VPS Deployment${NC}"
echo -e "${BOLD}============================================================${NC}"
echo ""

# ── 1. Install Docker if missing ──────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  info "Docker not found. Installing Docker Engine..."
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg lsb-release
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  success "Docker installed successfully."
else
  success "Docker $(docker --version | awk '{print $3}' | tr -d ',') already installed."
fi

# Verify Compose plugin
if ! docker compose version &>/dev/null; then
  info "Installing Docker Compose plugin..."
  apt-get install -y -qq docker-compose-plugin
fi
success "Docker Compose $(docker compose version --short) ready."

# ── 2. Create .env from template if missing ───────────────────────────────────
if [[ ! -f "$SCRIPT_DIR/.env" ]]; then
  if [[ ! -f "$SCRIPT_DIR/.env.example" ]]; then
    error ".env.example not found.  Ensure you cloned the full repository."
  fi
  cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
  warn ".env created from .env.example"
  warn "Edit $SCRIPT_DIR/.env and set a strong DB_PASSWORD, then re-run this script."
  exit 1
fi

# Source the .env
set -a; source "$SCRIPT_DIR/.env"; set +a

# Safety: abort if default password is still set
if [[ "${DB_PASSWORD:-}" == "CHANGE_ME_strong_password_here" || -z "${DB_PASSWORD:-}" ]]; then
  error "DB_PASSWORD is not set.  Edit $SCRIPT_DIR/.env before deploying."
fi

DB_NAME="${DB_NAME:-luckydb}"
DB_USER="${DB_USER:-luckyadmin}"
DB_PORT="${DB_PORT:-5432}"
BACKUP_DIR="${BACKUP_DIR:-/opt/lucky-draw/backups}"

success ".env loaded  (DB=${DB_NAME}, USER=${DB_USER}, PORT=${DB_PORT})"

# ── 3. Create backup directory ────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
success "Backup directory: $BACKUP_DIR"

# ── 4. Pull the Postgres image ────────────────────────────────────────────────
info "Pulling postgres:15-alpine..."
docker pull postgres:15-alpine --quiet
success "Image ready."

# ── 5. Start (or restart) the container ──────────────────────────────────────
info "Starting PostgreSQL container..."
docker compose -f "$SCRIPT_DIR/docker-compose.yml" up -d --remove-orphans
success "Container started."

# ── 6. Wait for the health check to pass ─────────────────────────────────────
info "Waiting for PostgreSQL to be ready..."
RETRIES=20
until docker exec luckydb pg_isready -U "$DB_USER" -d "$DB_NAME" -q 2>/dev/null; do
  RETRIES=$((RETRIES - 1))
  if [[ $RETRIES -le 0 ]]; then
    echo ""
    docker logs luckydb --tail 30
    error "PostgreSQL did not become ready in time.  See logs above."
  fi
  printf '.'
  sleep 3
done
echo ""
success "PostgreSQL is healthy and accepting connections."

# ── 7. Install daily backup cron job ─────────────────────────────────────────
BACKUP_SCRIPT="/usr/local/bin/lucky-draw-backup.sh"

cat > "$BACKUP_SCRIPT" <<BACKUP_EOF
#!/usr/bin/env bash
# Automated pg_dump backup for the Lucky Draw database.
set -euo pipefail
BACKUP_DIR="${BACKUP_DIR}"
CONTAINER="luckydb"
DB_NAME="${DB_NAME}"
DB_USER="${DB_USER}"
TIMESTAMP=\$(date +%Y%m%d_%H%M%S)
FILE="\${BACKUP_DIR}/\${DB_NAME}_\${TIMESTAMP}.sql.gz"
docker exec "\${CONTAINER}" pg_dump -U "\${DB_USER}" "\${DB_NAME}" | gzip > "\${FILE}"
echo "\$(date '+%Y-%m-%d %H:%M:%S')  Backup written to \${FILE}"
# Keep only the last 7 daily backups
find "\${BACKUP_DIR}" -name "*.sql.gz" -type f | sort | head -n -7 | xargs -r rm --
BACKUP_EOF

chmod +x "$BACKUP_SCRIPT"

# Add cron entry at 02:00 daily (if not already present)
CRON_ENTRY="0 2 * * * $BACKUP_SCRIPT >> /var/log/lucky-draw-backup.log 2>&1"
CRON_TMP=$(mktemp)
crontab -l 2>/dev/null | grep -v "lucky-draw-backup" > "$CRON_TMP" || true
echo "$CRON_ENTRY" >> "$CRON_TMP"
crontab "$CRON_TMP"
rm "$CRON_TMP"
success "Daily backup cron job installed (runs at 02:00, keeps last 7 dumps)."

# ── 8. Print summary ──────────────────────────────────────────────────────────
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:${DB_PORT}/${DB_NAME}"

echo ""
echo -e "${BOLD}============================================================${NC}"
echo -e "${GREEN}  Deployment complete!${NC}"
echo -e "${BOLD}============================================================${NC}"
echo ""
echo -e "  ${BOLD}Container:${NC}    luckydb  (postgres:15-alpine)"
echo -e "  ${BOLD}Listening:${NC}    127.0.0.1:${DB_PORT}  (loopback only)"
echo -e "  ${BOLD}Volume:${NC}       lucky_draw_pgdata"
echo -e "  ${BOLD}Backups:${NC}      ${BACKUP_DIR}  (daily at 02:00)"
echo ""
echo -e "${YELLOW}  Copy this DATABASE_URL into your backend .env:${NC}"
echo ""
echo -e "  ${CYAN}DATABASE_URL=${DATABASE_URL}${NC}"
echo ""
echo -e "${BOLD}  Useful commands:${NC}"
echo "  docker ps                          # confirm container is running"
echo "  docker logs luckydb -f             # stream Postgres logs"
echo "  docker exec -it luckydb psql -U ${DB_USER} ${DB_NAME}   # open psql shell"
echo "  $BACKUP_SCRIPT           # run a manual backup now"
echo ""
