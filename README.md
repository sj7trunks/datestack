# DateStack

A self-hosted calendar aggregator that syncs multiple Mac calendars into a single mobile-friendly web view, with a simple daily task list that follows you through your day.

## What This Project Does

DateStack aggregates calendar events from multiple Mac computers using [icalBuddy](https://hasseg.org/icalBuddy/) and combines them into a unified web interface. It's designed for people who need to see their complete schedule across work and personal machines—even when some are behind corporate firewalls.

The application provides:

- **Calendar Aggregation** — Sync calendars from multiple Macs to a single view
- **Simple Agenda** — A daily task list that automatically rolls over incomplete items
- **14-Day Horizon** — Always see two weeks ahead at a glance
- **Firewall Friendly** — Client pushes data out, so corporate firewalls aren't a problem

### Features

- **Flexible Views** — Switch between 1, 3, 7, or 14 day views with configurable defaults
- **Smart Navigation** — Forward/back buttons move by your current view size
- **Auto-Refresh** — Calendar updates every minute while the page is open
- **Inline Task Editing** — Click any task to edit, Enter to save, Escape to cancel
- **Automatic Rollover** — Unfinished tasks from past days move to today on page load
- **Color-Coded Calendars** — Each calendar gets its own color, customizable in Settings
- **Timezone Aware** — Auto-detects your browser timezone, shows local time when traveling
- **Availability Sharing** — Share a link showing your busy/free time without revealing event details
- **Privacy-First** — Self-hosted, your data stays on your server

## Why This Project Is Useful

DateStack is **not** a full-featured calendar application. It's a supplemental view designed for:

- **Multi-Mac Users** — See both your work Mac (behind VPN) and home Mac calendars together without cloud sync
- **Quick Daily Overview** — Glance at your schedule and tick off key tasks without app switching
- **Mobile Access** — Check your combined calendar from your phone while away from your computers
- **Simple Task Tracking** — Capture quick todos that follow you day-to-day without a complex task management system

## Getting Started

### Prerequisites

**Server:**
- [Node.js](https://nodejs.org/) (v18 or higher)
- Docker (recommended for production)

**Client (Mac):**
- macOS with Calendar app
- [Homebrew](https://brew.sh/)
- Python 3.8+

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/sj7trunks/datestack.git
   cd datestack
   ```

2. **Start the server**
   ```bash
   cd server
   npm install
   cp .env.example .env
   npm run dev
   # Server runs at http://localhost:8080
   ```

3. **Start the frontend** (in a new terminal)
   ```bash
   cd frontend
   npm install
   npm run dev
   # Frontend runs at http://localhost:3000
   ```

4. **Create an account**

   Navigate to `http://localhost:3000` and register a new account.

5. **Set up the client** (on your Mac)
   ```bash
   # Install icalBuddy
   brew install ical-buddy

   # Set up the Python client
   cd client
   python3 -m venv venv
   source venv/bin/activate
   pip install -e .

   # Initialize and configure
   datestack config init
   # Edit ~/.datestack/config.yaml with your server URL and API key
   ```

6. **Sync your calendar**
   ```bash
   datestack sync
   ```

### Building for Production

```bash
# Build frontend
cd frontend && npm run build

# Build server
cd server && npm run build
```

## Docker Deployment

### Using Docker Compose (Recommended)

1. **Configure environment**
   ```bash
   cp server/.env.example server/.env
   # Edit .env with a strong SECRET_KEY
   ```

2. **Build and start the container**
   ```bash
   docker-compose up -d --build
   ```

3. **Access the application**

   Navigate to `http://localhost:8080`

4. **Stop the container**
   ```bash
   docker-compose down
   ```

### Production Considerations

- Put DateStack behind a reverse proxy with SSL (Caddy, nginx, etc.)
- Set a strong `SECRET_KEY` (32+ random characters)
- Configure the `TIMEZONE` environment variable for your location
- Back up the SQLite database file regularly

## Client Configuration

The Mac client syncs your calendars to the server. Configure it at `~/.datestack/config.yaml`:

```yaml
server:
  url: "https://your-datestack-server.com"
  api_key: "dsk_your_api_key_here"

calendar:
  source_name: "Work Mac"
  exclude_calendars:
    - "Holidays"
    - "Birthdays"
  exclude_keywords:
    - "BLOCKED"
    - "OOO"
  days_ahead: 14

sync:
  interval_minutes: 5
```

### Running as a Background Service

See [client/README.md](client/README.md) for instructions on setting up launchd to run the sync daemon automatically.

## Project Structure

```
datestack/
├── server/              # Express.js API server
│   ├── src/
│   │   ├── routes/      # API endpoints
│   │   ├── middleware/  # Auth middleware
│   │   └── database.ts  # SQLite via sql.js
│   └── data/            # Database storage
├── frontend/            # React frontend
│   ├── src/
│   │   ├── pages/       # Main views
│   │   ├── components/  # UI components
│   │   ├── api/         # API client
│   │   └── contexts/    # React contexts
│   └── dist/            # Production build
├── client/              # Python Mac client
│   └── datestack/       # CLI commands
├── docker-compose.yml   # Container orchestration
└── Dockerfile           # Multi-stage build
```

## Getting Help

If you encounter issues or have questions:

- **[Open an Issue](https://github.com/sj7trunks/datestack/issues)** — Bug reports and feature requests
- **[Discussions](https://github.com/sj7trunks/datestack/discussions)** — Questions and general discussion

### Troubleshooting

**"icalBuddy not found"** — Install it with `brew install ical-buddy`

**Calendar permissions** — Grant Terminal access in System Preferences > Privacy & Security > Calendars

**Timezone issues** — Ensure your client sends dates correctly; the server never computes "today" for user requests

## Credits

### Dependencies

- **[icalBuddy](https://hasseg.org/icalBuddy/)** — Command-line calendar extraction for macOS
- **[sql.js](https://sql.js.org/)** — SQLite compiled to WebAssembly
- **[React Query](https://tanstack.com/query)** — Data fetching and caching

### Maintainer

**Benjamin Coles** — [@sj7trunks](https://github.com/sj7trunks)

### Contributors

- **[Benjamin Coles](https://github.com/sj7trunks)** — Project creator and maintainer
- **Claude (Anthropic)** — AI pair programming assistant

## License

MIT License — See [LICENSE](LICENSE) file for details.

---

*DateStack is a personal productivity tool, not a replacement for your primary calendar application.*
