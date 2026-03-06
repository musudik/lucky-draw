# Lucky Draw Event Management System

A full-stack web application for managing lucky draw events. Event managers can create events, share a QR-code registration link with participants, run a live animated prize wheel draw, and export participant records to Excel.

---

## Features

- **Event Manager Auth** — secure registration and login with JWT
- **Event Management** — create, edit, end, and reopen events
- **QR Code Registration** — participants self-register by scanning a unique QR code; no account needed
- **Participant Registration** — collects name, email, mobile, family status, services of interest, and consent
- **Live Draw** — animated spinning wheel powered by Socket.io for real-time results across all connected screens
- **Winner Management** — ranked winners with medal display; individual winners can be removed and redrawn
- **Excel Export** — download the full participant list as `.xlsx`
- **Duplicate Prevention** — one registration per email per event

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, Tailwind CSS 3, React Router 6 |
| Real-time | Socket.io (client + server) |
| Backend | Node.js 20, Express 4 |
| Database | PostgreSQL 15 |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| QR Code | qrcode (server-side PNG generation) |
| Excel Export | SheetJS (xlsx) |
| Proxy | NGINX |
| Containers | Docker + Docker Compose |

---

## Project Structure

```
lucky-draw/
├── docker-compose.yml          # Orchestrates all services
├── nginx/
│   └── nginx.conf              # Reverse proxy (API, WebSocket, SPA)
├── backend/
│   ├── Dockerfile
│   ├── .env.example
│   └── src/
│       ├── index.js            # Express + Socket.io entry point
│       ├── db/
│       │   ├── index.js        # pg connection pool
│       │   └── schema.sql      # Idempotent DDL (auto-run on startup)
│       ├── middleware/
│       │   └── auth.js         # JWT verification
│       └── routes/
│           ├── auth.js         # POST /api/auth/register, /login
│           ├── events.js       # Event CRUD + QR + end/reopen
│           ├── participants.js # Self-registration via QR token
│           ├── sponsors.js     # Sponsor management per event
│           ├── prizes.js       # Prize management per event
│           └── draw.js         # Draw logic + Socket.io emit
└── frontend/
    ├── Dockerfile              # Vite build → nginx:alpine (SPA)
    ├── vercel.json             # SPA fallback for Vercel
    ├── .env.example
    └── src/
        ├── App.jsx             # Routes + ProtectedRoute
        ├── api/api.js          # Axios instance (respects VITE_API_URL)
        ├── context/
        │   └── AuthContext.jsx # JWT auth state
        ├── components/
        │   ├── WheelCanvas.jsx # Animated canvas prize wheel
        │   └── Confetti.jsx    # Winner celebration
        └── pages/
            ├── Login.jsx
            ├── Register.jsx    # Public QR self-registration
            ├── Dashboard.jsx
            ├── EventCreate.jsx
            ├── EventDetail.jsx # QR display, participants, sponsors, prizes
            └── DrawScreen.jsx  # Live draw screen
```

---

## Database Schema

| Table | Purpose |
|---|---|
| `event_managers` | Authenticated event manager accounts |
| `events` | Events with unique QR token, status (active/ended) |
| `participants` | Registrants; unique per `(event_id, email)` |
| `sponsors` | Sponsors linked to an event |
| `prizes` | Ranked prizes, optionally linked to a sponsor |
| `winners` | Draw results; one prize per participant per event |

The schema is applied automatically on every backend startup (`schema.sql` uses `IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS` for safe re-runs).

---

## Environment Variables

### Backend — `backend/.env`

```env
# PostgreSQL connection string
DATABASE_URL=postgresql://DB_USER:DB_PASSWORD@DB_HOST:5432/DB_NAME

# Secret used to sign JWT tokens — use a long random string in production
JWT_SECRET=change_this_to_a_long_random_secret

# Port the backend listens on (default: 4000)
PORT=4000

# Allowed CORS origin — set to your frontend URL in production
FRONTEND_URL=http://localhost
```

### Frontend — `frontend/.env`

```env
# Full base URL of the deployed backend (no trailing slash).
# Leave empty (or omit the file) when running behind the NGINX proxy in Docker.
VITE_API_URL=
```

For Vercel deployments, set this to your VPS backend URL:

```env
VITE_API_URL=https://api.yourdomain.com
```

---

## Deployment — Docker (Self-hosted / VPS)

This is the recommended option for running the complete stack on a single server.

### Prerequisites

- Docker Engine 24+
- Docker Compose v2+

### Steps

```bash
git clone https://github.com/your-org/lucky-draw.git
cd lucky-draw
```

Edit `docker-compose.yml` and set the required values (search for `CHANGE_ME`):

```yaml
# backend environment section
JWT_SECRET: "a-long-random-secret-string"
FRONTEND_URL: "http://your-server-ip-or-domain"
```

Then build and start all services:

```bash
docker compose up --build -d
```

The app is available at `http://your-server-ip` (port 80).

To stop:

```bash
docker compose down
```

To view logs:

```bash
docker compose logs -f backend
docker compose logs -f nginx
```

### Startup Order

Docker Compose enforces the following readiness chain:

1. `postgres` → health-checked via `pg_isready`
2. `backend` → starts after postgres is healthy; health-checked via `/api/health`
3. `frontend` + `nginx` → start after backend is healthy

---

## Deployment — Vercel (Frontend) + VPS (Backend + Database)

Use this setup to host the React frontend on Vercel's CDN for free while running the backend and database on a private VPS.

### Architecture

```
Browser
  │
  ├─── HTTPS ──► Vercel CDN (React SPA)
  │
  └─── HTTPS ──► VPS (NGINX → Node.js API → PostgreSQL)
```

---

### Part 1 — Set Up PostgreSQL on the VPS

A self-contained deployment script is provided at `deploy/vps-db/deploy.sh`. It installs Docker if needed, starts a PostgreSQL 15 container bound to `127.0.0.1` only, and configures a daily backup cron job automatically.

**Steps:**

```bash
# On the VPS
git clone https://github.com/your-org/lucky-draw.git /opt/lucky-draw
cd /opt/lucky-draw/deploy/vps-db

# Create your .env from the template
cp .env.example .env
nano .env          # set DB_PASSWORD and optionally DB_NAME / DB_USER / DB_PORT
```

`deploy/vps-db/.env` keys:

| Variable | Default | Description |
|---|---|---|
| `DB_NAME` | `luckydb` | PostgreSQL database name |
| `DB_USER` | `luckyadmin` | PostgreSQL user |
| `DB_PASSWORD` | *(required)* | **Must be changed** before first run |
| `DB_PORT` | `5432` | Host port bound to `127.0.0.1` |
| `BACKUP_DIR` | `/opt/lucky-draw/backups` | Directory for daily `.sql.gz` dumps |

Run the script:

```bash
chmod +x deploy.sh
sudo ./deploy.sh
```

The script will:
1. Install Docker Engine + Compose plugin if not already present
2. Validate that `DB_PASSWORD` has been changed from the template default
3. Pull `postgres:15-alpine` and start the container
4. Wait for the healthcheck to pass
5. Install a daily backup cron job (runs at 02:00, retains last 7 dumps)
6. Print the `DATABASE_URL` ready to paste into the backend `.env`

The script is **idempotent** — safe to re-run for upgrades or restarts.

> **Security:** PostgreSQL is bound to `127.0.0.1:5432` and never exposed on a public interface. No firewall rule is needed for the database port.

Useful commands after deployment:

```bash
docker ps                                              # confirm container is running
docker logs luckydb -f                                 # stream Postgres logs
docker exec -it luckydb psql -U luckyadmin luckydb    # open an interactive psql shell
sudo /usr/local/bin/lucky-draw-backup.sh               # trigger a manual backup
ls /opt/lucky-draw/backups/                            # list backup files
```

---

### Part 2 — Deploy the Backend on the VPS

> **Important:** The backend must run on the VPS — **not** on Vercel.
> Vercel is a serverless platform and does not support long-running Express processes or Socket.io WebSocket connections.

A deployment script is provided at `deploy/vps-backend/deploy-backend.sh`. It installs Node.js 20 and PM2, copies the backend source, wires the `.env`, handles PM2 startup persistence, and optionally configures NGINX + Let’s Encrypt HTTPS in one pass.

**Steps:**

```bash
cd /opt/lucky-draw/deploy/vps-backend

cp .env.example .env
nano .env    # fill in all values (see table below)
```

`deploy/vps-backend/.env` keys:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string — use `127.0.0.1` if the DB is on the same VPS |
| `JWT_SECRET` | Long random string — generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `PORT` | Port the backend listens on (default: `4000`) |
| `FRONTEND_URL` | Your Vercel app URL — controls CORS and Socket.io origin |
| `BACKEND_DOMAIN` | *(Optional)* Domain for NGINX + Let’s Encrypt (e.g. `api.yourdomain.com`) |
| `CERTBOT_EMAIL` | *(Optional)* Email for TLS certificate renewal notices |

Run the script:

```bash
chmod +x deploy-backend.sh
sudo ./deploy-backend.sh
```

The script will:
1. Install Node.js 20 if not present
2. Install PM2 globally and configure it to survive reboots
3. Copy backend source files to `/opt/lucky-draw/backend`
4. Install npm production dependencies
5. Start the API as a PM2 process named `lucky-draw-api`
6. If `BACKEND_DOMAIN` is set: configure NGINX as a reverse proxy and request a Let’s Encrypt TLS certificate
7. Print the `VITE_API_URL` value to set in your Vercel environment variables

The script is **idempotent** — re-run it after any code change to redeploy.

Useful commands after deployment:

```bash
pm2 logs lucky-draw-api        # stream live logs
pm2 status                      # process health
pm2 restart lucky-draw-api      # restart manually
sudo ./deploy-backend.sh        # redeploy after pulling new code
```

> **Socket.io:** The NGINX config written by the script includes the `Upgrade` / `Connection: upgrade` headers required for WebSocket connections (live draw screen).

---
### Part 3 — Deploy the Frontend on Vercel

#### Option A — Vercel CLI

```bash
cd frontend
npm install -g vercel
vercel
```

Follow the prompts. When asked for the build settings:

| Setting | Value |
|---|---|
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |

#### Option B — Vercel Dashboard (GitHub integration)

1. Push the repository to GitHub.
2. Open [vercel.com](https://vercel.com) → **New Project** → import your repo.
3. Set **Root Directory** to `frontend`.
4. Vercel auto-detects Vite. Confirm build command `npm run build` and output directory `dist`.

#### Set the environment variable in Vercel

In your Vercel project → **Settings** → **Environment Variables**, add:

| Name | Value |
|---|---|
| `VITE_API_URL` | `https://api.yourdomain.com` |

Apply to **Production**, **Preview**, and **Development** environments.

Then redeploy (or run `vercel --prod` from the CLI).

The `frontend/vercel.json` included in this repo handles SPA routing so that direct URLs like `https://your-app.vercel.app/event/login` work correctly without a 404.

---

### Part 4 — Verify the Deployment

1. Open `https://your-app.vercel.app/event/login` — the login page loads.
2. Register a manager account.
3. Create an event — a QR code appears in the event detail page.
4. Open the registration link in another browser/device — the self-registration form loads.
5. Submit the form, then go back to the event detail page — the participant appears in the table.
6. Click **Run Draw** — the spinning wheel animates and a winner is drawn live.

---

## Local Development (without Docker)

### Requirements

- Node.js 20+
- PostgreSQL 15+ running locally

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env — set DATABASE_URL to your local postgres instance
npm install
npm run dev      # starts with nodemon on port 4000
```

### Frontend

```bash
cd frontend
cp .env.example .env
# VITE_API_URL can be left empty — Vite proxies /api to localhost:4000
npm install
npm run dev      # Vite dev server on port 3000
```

The Vite dev server proxies `/api` and `/socket.io` to `http://localhost:4000` automatically, so no CORS configuration is needed locally.

Open `http://localhost:3000/event/login`.

---

## API Reference

All protected endpoints require the header:
```
Authorization: Bearer <jwt_token>
```

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Create manager account |
| POST | `/api/auth/login` | No | Login, returns JWT |
| GET | `/api/events` | Yes | List manager's events |
| POST | `/api/events` | Yes | Create event |
| GET | `/api/events/:id` | Yes | Get event details |
| PUT | `/api/events/:id` | Yes | Update event |
| DELETE | `/api/events/:id` | Yes | Delete event |
| GET | `/api/events/:id/qr` | Yes | Download QR code PNG |
| POST | `/api/events/:id/end` | Yes | Close registrations |
| POST | `/api/events/:id/reopen` | Yes | Reopen registrations |
| GET | `/api/events/:id/participants` | Yes | List participants |
| GET | `/api/events/:id/winners` | Yes | List winners |
| DELETE | `/api/events/:id/winners/:wId` | Yes | Remove a winner |
| POST | `/api/events/:id/draw` | Yes | Run a draw, emit Socket.io event |
| GET | `/api/events/:id/sponsors` | Yes | List sponsors |
| POST | `/api/events/:id/sponsors` | Yes | Add sponsor |
| DELETE | `/api/events/:id/sponsor/:sId` | Yes | Remove sponsor |
| GET | `/api/events/:id/prizes` | Yes | List prizes |
| POST | `/api/events/:id/prizes` | Yes | Add prize |
| DELETE | `/api/events/:id/prize/:pId` | Yes | Remove prize |
| POST | `/api/participants` | No | Self-register via QR token |
| GET | `/api/health` | No | Health check |

### Socket.io Events

| Direction | Event | Payload |
|---|---|---|
| Client → Server | `join:event` | `eventId` (string) |
| Client → Server | `leave:event` | `eventId` (string) |
| Server → Client | `draw:winner` | `{ winner, participant, prize }` |
