"""Configuration management for DateStack client."""

import os
from pathlib import Path
from typing import Optional
import yaml

CONFIG_DIR = Path.home() / ".datestack"
CONFIG_FILE = CONFIG_DIR / "config.yaml"

DEFAULT_CONFIG = {
    "server": {
        "url": "http://localhost:8080",
        "api_key": "",
    },
    "calendar": {
        "source_name": "My Mac",
        "exclude_calendars": [],
        "exclude_keywords": [],
        "days_ahead": 14,
    },
    "sync": {
        "interval_minutes": 15,
    },
}


def get_config_dir() -> Path:
    """Get the configuration directory path."""
    return CONFIG_DIR


def get_config_file() -> Path:
    """Get the configuration file path."""
    return CONFIG_FILE


def load_config() -> dict:
    """Load configuration from file, merging with defaults."""
    config = DEFAULT_CONFIG.copy()

    if CONFIG_FILE.exists():
        with open(CONFIG_FILE, "r") as f:
            user_config = yaml.safe_load(f) or {}

        # Deep merge user config into defaults
        for section, values in user_config.items():
            if section in config and isinstance(config[section], dict):
                config[section].update(values)
            else:
                config[section] = values

    return config


def save_config(config: dict) -> None:
    """Save configuration to file."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)

    with open(CONFIG_FILE, "w") as f:
        yaml.dump(config, f, default_flow_style=False, sort_keys=False)


def init_config() -> Path:
    """Initialize a new configuration file with defaults."""
    if CONFIG_FILE.exists():
        return CONFIG_FILE

    CONFIG_DIR.mkdir(parents=True, exist_ok=True)

    # Write default config with comments
    config_content = """# DateStack Client Configuration

server:
  # URL of your DateStack server
  url: "http://localhost:8080"
  # API key generated from Settings > API Keys
  api_key: ""

calendar:
  # Name for this calendar source (shown in the web UI)
  source_name: "My Mac"
  # Calendars to exclude from sync
  exclude_calendars: []
  # Events containing these keywords will be excluded
  exclude_keywords: []
  # Number of days ahead to sync
  days_ahead: 14

sync:
  # Interval in minutes for daemon mode
  interval_minutes: 15
"""

    with open(CONFIG_FILE, "w") as f:
        f.write(config_content)

    return CONFIG_FILE


def validate_config(config: dict) -> list[str]:
    """Validate configuration and return list of errors."""
    errors = []

    if not config.get("server", {}).get("url"):
        errors.append("server.url is required")

    if not config.get("server", {}).get("api_key"):
        errors.append("server.api_key is required")

    if not config.get("calendar", {}).get("source_name"):
        errors.append("calendar.source_name is required")

    return errors
