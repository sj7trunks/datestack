# DateStack Client

A command-line tool for syncing your macOS Calendar to DateStack.

## Requirements

- macOS with Calendar app
- Python 3.8+
- icalBuddy (for calendar extraction)

## Installation

### 1. Install icalBuddy

```bash
brew install ical-buddy
```

### 2. Install the DateStack client

```bash
cd client

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate

# Install the client
pip install -e .
```

### 3. Initialize configuration

```bash
datestack config init
```

This creates `~/.datestack/config.yaml`. Edit it with your server URL and API key.

### 4. Get an API key

1. Log into your DateStack web interface
2. Go to **Settings**
3. Create a new API key
4. Copy the key and paste it into your config file

## Configuration

Edit `~/.datestack/config.yaml`:

```yaml
server:
  url: "https://your-datestack-server.com"
  api_key: "dsk_your_api_key_here"

calendar:
  source_name: "Work Mac"        # Name shown in the web UI
  exclude_calendars:             # Calendars to skip
    - "Holidays"
    - "Birthdays"
  exclude_keywords:              # Skip events containing these words
    - "BLOCKED"
    - "OOO"
  days_ahead: 14                 # How many days to sync

sync:
  interval_minutes: 15           # For daemon mode
```

## Usage

Always activate the virtual environment first:

```bash
cd /path/to/datestack/client
source venv/bin/activate
```

### Sync your calendar

```bash
# One-time sync
datestack sync

# Run continuously (syncs every 15 minutes)
datestack sync --daemon

# Force a complete re-sync
datestack sync --force
```

### Manage agenda items

```bash
# List today's tasks
datestack agenda list

# List tasks for a specific date
datestack agenda list --date 2024-01-15

# Add a new task
datestack agenda add "Finish quarterly report"

# Add a task for a specific date
datestack agenda add "Submit expenses" --date 2024-01-20

# Mark a task as complete
datestack agenda complete 123

# Undo completion
datestack agenda uncomplete 123
```

### Configuration commands

```bash
# Show current configuration
datestack config show

# Test connection to server
datestack config test
```

## Running as a Background Service

### Using launchd (recommended for macOS)

Create `~/Library/LaunchAgents/com.datestack.sync.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.datestack.sync</string>
    <key>ProgramArguments</key>
    <array>
        <string>/path/to/datestack/client/venv/bin/datestack</string>
        <string>sync</string>
        <string>--daemon</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/datestack.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/datestack.error.log</string>
</dict>
</plist>
```

Then load it:

```bash
launchctl load ~/Library/LaunchAgents/com.datestack.sync.plist
```

To stop:

```bash
launchctl unload ~/Library/LaunchAgents/com.datestack.sync.plist
```

## Troubleshooting

### "icalBuddy not found"

Install it with Homebrew:
```bash
brew install ical-buddy
```

### "Configuration errors: server.api_key is required"

Edit `~/.datestack/config.yaml` and add your API key from the DateStack web interface.

### "Connection failed"

1. Check that your server URL is correct
2. Verify the server is running: `curl https://your-server.com/health`
3. Check your network connection

### Calendar permissions

If icalBuddy can't access your calendars, grant it permission:

1. Open **System Preferences** > **Security & Privacy** > **Privacy**
2. Select **Calendars** in the left sidebar
3. Ensure Terminal (or your terminal app) is checked

## Uninstalling

```bash
# Remove the virtual environment
rm -rf /path/to/datestack/client/venv

# Remove configuration
rm -rf ~/.datestack

# Remove launchd service (if installed)
launchctl unload ~/Library/LaunchAgents/com.datestack.sync.plist
rm ~/Library/LaunchAgents/com.datestack.sync.plist
```
