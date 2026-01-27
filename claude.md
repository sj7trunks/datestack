# DateStack

**Simple 14 day Calendar Application that uses a client and server to handle multiple calendar sources, sometimes behind firewalls**

DateStack aggregates calendar events from multiple Mac computers (using icalBuddy) and combines them into a single, mobile-friendly web interface. Perfect for people who need to see their complete schedule across work and personal machines, even when some are behind corporate firewalls.

---

## Features

### Calendar Aggregation
- **Multi-source support** — Sync calendars from multiple Macs to a single view
- **14-day horizon** — Always see two weeks ahead
- **Behind firewalls** — Client pushes data out, so corporate firewalls aren't a problem
- **Color-coded sources** — Each calendar source gets its own color (customizable)
- **Smart filtering** — Exclude specific calendars or events containing certain keywords

### Agenda / Task List
- **Quick capture** — Add simple one-line tasks
- **Daily rollover** — Unfinished items automatically carry forward
- **Completion tracking** — Check off items with visual strikethrough
- **Undo support** — Accidentally checked something? Just uncheck it
- **Auto-archive** — Completed items archived daily with completion date

### Mobile-First Web Interface
- **Flexible views** — 1 day, 3 days, 7 days, or 14 days
- **Day-by-day navigation** — Step forward or back one day at a time
- **Expandable notes** — Keep the view clean, expand details when needed
- **Smart sorting** — Agenda first, then events in chronological order
- **Timezone aware** — Shows PST by default, or your local time when traveling

### Notifications
- **ntfy integration** — Push notifications to your phone
- **Configurable timing** — Default 5 minutes before events
- **Works anywhere** — Use public ntfy.sh or your own server

---

## Why DateStack?

- **Corporate + Personal** — See both your work Mac (behind VPN) and home Mac calendars together
- **No cloud calendar sync needed** — Works with native macOS Calendar app
- **Self-hosted** — Your data stays on your server
- **Simple** — Minimal setup, just works

---

## Installation Requirements

### Server
- Node.js 18+
- SQLite (bundled via sql.js)
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
version: '3.8'

services:
  datestack:
    build: .
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=/app/data/datestack.db
      - SECRET_KEY=${SECRET_KEY:-change-me-to-a-random-string}
    volumes:
      - datestack_data:/app/data
    restart: unless-stopped

volumes:
  datestack_data:
```

---

## Production Considerations

### Database
- SQLite (via sql.js) works well for personal use and small teams
- Data is persisted to disk automatically
- For backup, simply copy the database file

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
# Docker volume backup
docker cp datestack_datestack_1:/app/data/datestack.db ./backup/datestack-$(date +%Y%m%d).db

# Or if running without Docker
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

## Credits

- **[icalBuddy](https://hasseg.org/icalBuddy/)** — The excellent command-line tool that makes calendar extraction on macOS possible
- **[ntfy](https://ntfy.sh/)** — Simple, HTTP-based push notifications

---

## Contributors

- **[Benjamin Coles](https://github.com/sj7trunks)** — Project creator and maintainer
- **Claude (Anthropic)** — AI pair programming assistant
