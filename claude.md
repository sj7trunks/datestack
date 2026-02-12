# DateStack

**Simple 14 day Calendar Application that uses a client and server to handle multiple calendar sources, sometimes behind firewalls**

DateStack aggregates calendar events from multiple Mac computers (using icalBuddy) and combines them into a single, mobile-friendly web interface. Perfect for people who need to see their complete schedule across work and personal machines, even when some are behind corporate firewalls.

---

## Features

### Calendar Aggregation
- **Multi-source support** — Sync calendars from multiple Macs to a single view
- **14-day horizon** — Always see two weeks ahead
- **Behind firewalls** — Client pushes data out, so corporate firewalls aren't a problem
- **All-day events** — All-day events are detected by datetime format (date-only = all-day) and displayed above timed events
- **Color-coded calendars** — Each individual calendar gets its own color (auto-assigned on first sync, customizable per-calendar in Settings). Settings page only shows calendars that have events. "Purge unused colors" button cleans up stale entries.
- **Smart filtering** — Exclude specific calendars or events containing certain keywords (dual filtering: icalBuddy -ec flag + Python post-filter for reliability with multi-day events)

### Agenda / Task List
- **Quick capture** — Add simple one-line tasks
- **Inline editing** — Click on any task to edit its text (Enter to save, Escape to cancel)
- **Smart sorting** — Uncompleted items first (by date added), then completed items
- **Automatic rollover** — Unfinished items from past days automatically move to today on page load
- **Completion tracking** — Check off items with visual strikethrough
- **Undo support** — Accidentally checked something? Just uncheck it
- **Auto-archive** — Completed items archived daily with completion date

### Mobile-First Web Interface
- **Flexible views** — 1 day, 3 days, 7 days, or 14 days (default configurable in Settings)
- **Smart navigation** — Forward/back buttons move by the current view size (7-day view moves 7 days at a time)
- **Auto-refresh** — Calendar updates every minute while the page is open
- **Expandable notes** — Keep the view clean, expand details when needed
- **Smart sorting** — Agenda first, then events in chronological order
- **Timezone aware** — Auto-detects browser timezone, shows local time when traveling

### Admin Panel
- **First user is admin** — User with `id=1` is automatically the admin (no config needed)
- **Admin link** — "Admin" link appears in the Calendar header only for the admin user
- **User management** — View all users with email, join date, and event count. Reset any user's password inline.
- **Database backup** — Download the SQLite database file from the browser
- **Database restore** — Upload a .db file to replace the current database (auto-backs up the current DB first)
- **Admin middleware** — `requireAdmin` middleware in `server/src/middleware/auth.ts` gates all `/api/admin` routes

### Notifications
- **ntfy integration** — Push notifications to your phone
- **Configurable timing** — Default 5 minutes before events
- **Works anywhere** — Use public ntfy.sh or your own server

### Timezone Handling
- **Client-authoritative dates** — The server never computes "today" for user-facing requests. All API endpoints that need a date (`GET /api/agenda`, `POST /api/agenda`, `POST /api/agenda/rollover`) require the client to send the date explicitly. This prevents UTC vs local timezone mismatches.
- **Browser auto-detection** — The frontend uses `Intl.DateTimeFormat().resolvedOptions().timeZone` to detect the user's timezone automatically. No hardcoded timezone.
- **Local time strings for API queries** — Frontend sends event queries using local time format (`yyyy-MM-dd'T'HH:mm:ss`) instead of UTC ISO strings. This ensures all-day events (stored as `T00:00:00`) are correctly matched regardless of timezone offset.
- **Server sync cleanup** — Uses local time strings (no Z suffix) for delete range to match stored event format.
- **Server `TIMEZONE` env var** — Only used for headless/cron operations (`POST /api/agenda/rollover-all`, sync cleanup) where there is no client. Defaults to `America/Los_Angeles`.
- **`getToday()` helper** — Server-side helper in `database.ts` that returns today's date string using the `TIMEZONE` env var. Only used by rollover-all and sync cleanup, never for user-facing requests.
- **UTC timestamp conversion** — Server stores timestamps in UTC. Frontend appends 'Z' suffix when parsing to ensure correct local time display (e.g., sync times in Settings).

---

## Why DateStack?

- **Corporate + Personal** — See both your work Mac (behind VPN) and home Mac calendars together
- **No cloud calendar sync needed** — Works with native macOS Calendar app
- **Self-hosted** — Your data stays on your server
- **Simple** — Minimal setup, just works

---

## Installation Requirements

### Server
- Node.js 20+
- PostgreSQL 16+ (production, via Docker)
- SQLite (bundled via sql.js, for local development)
- Docker (recommended for production)

### Client (Mac)
- macOS with Calendar app
- Homebrew
- icalBuddy: `brew install ical-buddy`
- Python 3.8+

---

## Quick Start

### 1. Deploy the Server

```bash
git clone https://github.com/sj7trunks/datestack.git
cd datestack

# Copy and edit environment file
cp server/.env.example server/.env
# Edit .env with your SECRET_KEY

# Run with Docker
docker-compose up -d
```

### 2. Create an Account

Visit `http://your-server:8080` and register a new account.

### 3. Generate an API Key

Go to Settings → API Keys → Create New Key

### 4. Configure the Client

```bash
# Install icalBuddy
brew install ical-buddy

# Install client in a virtual environment
cd client
python3 -m venv venv
source venv/bin/activate
pip install -e .

# Initialize config
datestack config init

# Edit ~/.datestack/config.yaml with your server URL and API key
```

### 5. Sync Your Calendar

```bash
# Activate the virtual environment (if not already active)
source venv/bin/activate

# Manual sync
datestack sync

# Or run as a daemon (syncs every 15 minutes)
datestack sync --daemon
```

See `client/README.md` for detailed client documentation including running as a background service.

---

## Running a Local Development Copy

### Server

```bash
cd server
npm install

# Set up environment
cp .env.example .env

# Start development server (with hot reload)
npm run dev
# Server runs at http://localhost:8080
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Frontend runs at http://localhost:3000
# (proxies API requests to localhost:8080)
```

### Client

```bash
cd client

# Create virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -e .

# Create test config
datestack config init

# Edit ~/.datestack/config.yaml:
#   server.url: "http://localhost:8080"
#   server.api_key: (get from web UI after registering)
```

---

## Building for Production

### Using Docker Compose

```bash
# Build and run
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Dockerfile

The included Dockerfile:
- Uses Node.js 20 slim base image
- Multi-stage build for smaller image
- Bundles the built frontend with the server
- Runs with Node.js
- Exposes port 8080

### Docker Compose Configuration

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=datestack
      - POSTGRES_PASSWORD=datestack
      - POSTGRES_DB=datestack
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U datestack"]
      interval: 10s
      timeout: 3s
      retries: 5
      start_period: 10s

  datestack:
    build: .
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://datestack:datestack@postgres:5432/datestack
      - SECRET_KEY=${SECRET_KEY:-change-me-to-a-random-string}
      - TIMEZONE=America/Los_Angeles
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

volumes:
  pgdata:
```

---

## Production Considerations

### Database
- **Production:** PostgreSQL 16 via Docker (set `DATABASE_URL=postgresql://...`)
- **Development:** SQLite via sql.js (default when `DATABASE_URL` is a file path or unset)
- **Dual-backend abstraction:** `server/src/database.ts` detects the backend from `DATABASE_URL` and handles all SQL dialect translation (placeholder conversion, datetime functions, boolean literals, schema DDL). All route files use the same `query()`, `queryOne()`, `run()` API regardless of backend.
- All database functions are async (`Promise`-based) to support both backends uniformly

### Reverse Proxy
Put DateStack behind a reverse proxy with SSL:

**Caddy (recommended):**
```
datestack.example.com {
    reverse_proxy localhost:8080
}
```

**nginx:**
```nginx
server {
    listen 443 ssl;
    server_name datestack.example.com;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Security
- Always use HTTPS in production
- Set a strong `SECRET_KEY` (32+ random characters)
- Consider rate limiting on the API

### Backups
```bash
# PostgreSQL backup (production)
docker compose exec postgres pg_dump -U datestack datestack > ./backup/datestack-$(date +%Y%m%d).sql

# SQLite backup (development)
cp /path/to/data/datestack.db ./backup/datestack-$(date +%Y%m%d).db
```

### Monitoring
- Health check endpoint: `GET /health`
- Logs written to stdout (capture with Docker or systemd)

---

## Client Configuration

### Full Configuration File

`~/.datestack/config.yaml`:

```yaml
server:
  url: "https://datestack.example.com"
  api_key: "dsk_your_api_key_here"

calendar:
  source_name: "Work Mac"
  exclude_calendars:
    - "TG - School Calendar"
    - "Holidays"
  exclude_keywords:
    - "BLOCKED"
    - "OOO"
  days_ahead: 14

sync:
  interval_minutes: 15
```

### Client Commands

```bash
# Calendar sync
datestack sync              # One-time sync
datestack sync --daemon     # Run continuously
datestack sync --force      # Force full re-sync

# Agenda management
datestack agenda add "Finish quarterly report"
datestack agenda list
datestack agenda complete abc123
datestack agenda uncomplete abc123

# Configuration
datestack config init       # Create config file
datestack config show       # Display current config
datestack config test       # Test server connection
```

---

## Getting Help

### Issues

Found a bug or have a feature request? Please open an issue on GitHub:

**[github.com/sj7trunks/datestack/issues](https://github.com/sj7trunks/datestack/issues)**

When reporting bugs, please include:
- Your operating system and version
- Python/Node version
- Steps to reproduce the issue
- Any relevant error messages

### Discussions

For questions and general discussion, use GitHub Discussions:

**[github.com/sj7trunks/datestack/discussions](https://github.com/sj7trunks/datestack/discussions)**

---

## License

MIT License

Copyright (c) 2025 Benjamin Coles

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## TODO / Future Features

### Pre-PR Database Backup Hook
- Add Claude Code hook to automatically backup database before destructive operations
- Example hook in `.claude/settings.json` to run `cp server/data/datestack.db server/data/datestack.db.backup`
- Manual backup command: `cp server/data/datestack.db server/data/datestack-$(date +%Y%m%d-%H%M%S).db`

---

## Credits

- **[icalBuddy](https://hasseg.org/icalBuddy/)** — The excellent command-line tool that makes calendar extraction on macOS possible
- **[ntfy](https://ntfy.sh/)** — Simple, HTTP-based push notifications

---

## Contributors

- **[Benjamin Coles](https://github.com/sj7trunks)** — Project creator and maintainer
- **Claude (Anthropic)** — AI pair programming assistant
