"""Command-line interface for DateStack client."""

import sys
import time
import click
import requests

from . import __version__
from .config import (
    load_config,
    init_config,
    get_config_file,
    validate_config,
)
from .sync import run_sync, check_icalbuddy
from .agenda import list_items, add_item, complete_item, uncomplete_item


@click.group()
@click.version_option(version=__version__)
def cli():
    """DateStack - Calendar aggregation client for macOS."""
    pass


# ============================================================================
# Config commands
# ============================================================================


@cli.group()
def config():
    """Configuration management."""
    pass


@config.command("init")
def config_init():
    """Create a new configuration file."""
    config_file = init_config()
    click.echo(f"Configuration file created at: {config_file}")
    click.echo("Edit this file with your server URL and API key.")


@config.command("show")
def config_show():
    """Display current configuration."""
    cfg = load_config()
    config_file = get_config_file()

    click.echo(f"Configuration file: {config_file}")
    click.echo()

    click.echo("Server:")
    click.echo(f"  URL: {cfg['server']['url']}")
    click.echo(f"  API Key: {'*' * 8 if cfg['server']['api_key'] else '(not set)'}")
    click.echo()

    click.echo("Calendar:")
    click.echo(f"  Source Name: {cfg['calendar']['source_name']}")
    click.echo(f"  Exclude Calendars: {cfg['calendar']['exclude_calendars']}")
    click.echo(f"  Exclude Keywords: {cfg['calendar']['exclude_keywords']}")
    click.echo(f"  Days Ahead: {cfg['calendar']['days_ahead']}")
    click.echo()

    click.echo("Sync:")
    click.echo(f"  Interval: {cfg['sync']['interval_minutes']} minutes")


@config.command("test")
def config_test():
    """Test server connection."""
    cfg = load_config()
    errors = validate_config(cfg)

    if errors:
        click.echo("Configuration errors:", err=True)
        for error in errors:
            click.echo(f"  - {error}", err=True)
        sys.exit(1)

    server_url = cfg["server"]["url"].rstrip("/")

    try:
        # Test health endpoint
        response = requests.get(f"{server_url}/health", timeout=10)
        response.raise_for_status()

        click.echo(f"Server connection: OK ({server_url})")

        # Test API key
        response = requests.get(
            f"{server_url}/api/sources",
            headers={"X-API-Key": cfg["server"]["api_key"]},
            timeout=10,
        )
        response.raise_for_status()

        click.echo("API key: Valid")
        click.echo()
        click.echo("Connection test passed!")

    except requests.exceptions.ConnectionError:
        click.echo(f"Connection failed: Could not connect to {server_url}", err=True)
        sys.exit(1)
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 401:
            click.echo("API key: Invalid", err=True)
        else:
            click.echo(f"Server error: {e}", err=True)
        sys.exit(1)


# ============================================================================
# Sync commands
# ============================================================================


@cli.command()
@click.option("--daemon", is_flag=True, help="Run continuously")
@click.option("--force", is_flag=True, help="Force full re-sync")
def sync(daemon: bool, force: bool):
    """Sync calendar events to server."""
    if not check_icalbuddy():
        click.echo("Error: icalBuddy not found.", err=True)
        click.echo("Install with: brew install ical-buddy", err=True)
        sys.exit(1)

    cfg = load_config()
    errors = validate_config(cfg)
    if errors:
        click.echo("Configuration errors:", err=True)
        for error in errors:
            click.echo(f"  - {error}", err=True)
        sys.exit(1)

    if daemon:
        interval = cfg["sync"]["interval_minutes"] * 60
        click.echo(f"Running in daemon mode (syncing every {cfg['sync']['interval_minutes']} minutes)")
        click.echo("Press Ctrl+C to stop")
        click.echo()

        while True:
            try:
                _do_sync(force=force)
                force = False  # Only force on first sync
            except Exception as e:
                click.echo(f"Sync error: {e}", err=True)

            time.sleep(interval)
    else:
        try:
            _do_sync(force=force)
        except Exception as e:
            click.echo(f"Sync error: {e}", err=True)
            sys.exit(1)


def _do_sync(force: bool = False):
    """Perform a single sync operation."""
    click.echo(f"Syncing... ", nl=False)
    result = run_sync(force=force)
    click.echo(
        f"Found {result['events_found']} events, "
        f"synced {result['events_synced']} to server."
    )


# ============================================================================
# Agenda commands
# ============================================================================


@cli.group()
def agenda():
    """Manage agenda items."""
    pass


@agenda.command("list")
@click.option("--date", "-d", help="Date (YYYY-MM-DD), defaults to today")
def agenda_list(date: str):
    """List agenda items."""
    try:
        items = list_items(date)

        if not items:
            click.echo("No agenda items.")
            return

        for item in items:
            status = "[x]" if item["completed"] else "[ ]"
            text = item["text"]
            if item["completed"]:
                text = click.style(text, dim=True)
            click.echo(f"{item['id']:4d} {status} {text}")

    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(1)


@agenda.command("add")
@click.argument("text")
@click.option("--date", "-d", help="Date (YYYY-MM-DD), defaults to today")
def agenda_add(text: str, date: str):
    """Add a new agenda item."""
    try:
        item = add_item(text, date)
        click.echo(f"Added: {item['id']} - {item['text']}")
    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(1)


@agenda.command("complete")
@click.argument("item_id", type=int)
def agenda_complete(item_id: int):
    """Mark an agenda item as completed."""
    try:
        item = complete_item(item_id)
        click.echo(f"Completed: {item['text']}")
    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(1)


@agenda.command("uncomplete")
@click.argument("item_id", type=int)
def agenda_uncomplete(item_id: int):
    """Mark an agenda item as not completed."""
    try:
        item = uncomplete_item(item_id)
        click.echo(f"Uncompleted: {item['text']}")
    except Exception as e:
        click.echo(f"Error: {e}", err=True)
        sys.exit(1)


if __name__ == "__main__":
    cli()
