"""Calendar sync functionality using icalBuddy."""

import subprocess
import re
from datetime import datetime, timedelta
from typing import Optional
from dateutil import parser as dateparser
import requests

from .config import load_config, validate_config


# Regex to strip ANSI escape codes
ANSI_ESCAPE = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')


def strip_ansi(text: str) -> str:
    """Remove ANSI escape codes from text."""
    return ANSI_ESCAPE.sub('', text)


def check_icalbuddy() -> bool:
    """Check if icalBuddy is installed."""
    try:
        result = subprocess.run(
            ["which", "icalBuddy"],
            capture_output=True,
            text=True,
        )
        return result.returncode == 0
    except Exception:
        return False


def get_events_from_icalbuddy(
    days_ahead: int = 14,
    exclude_calendars: list[str] = None,
) -> list[dict]:
    """
    Extract calendar events using icalBuddy.

    Returns a list of event dictionaries with:
    - title: Event title
    - start_time: ISO datetime string
    - end_time: ISO datetime string (optional)
    - location: Event location (optional)
    - notes: Event notes (optional)
    - all_day: Boolean
    - calendar: Calendar name
    - external_id: Unique identifier
    """
    if not check_icalbuddy():
        raise RuntimeError(
            "icalBuddy not found. Install with: brew install ical-buddy"
        )

    exclude_calendars = exclude_calendars or []

    # Build icalBuddy command - options must come BEFORE the command
    cmd = [
        "icalBuddy",
        "-f",  # Format output
        "-nrd",  # No relative dates
        "-ea",  # Exclude all-day events separately
        "-tf", "%Y-%m-%dT%H:%M:%S",  # Time format (ISO)
        "-df", "%Y-%m-%d",  # Date format
        "-iep", "title,datetime,location,notes,uid",  # Include these properties
        "-po", "title,datetime,location,notes,uid",  # Property order
        "-b", "|||",  # Bullet point separator
        "-ps", "| :: |",  # Property separator
        "-sc",  # Separate by calendar (show calendar headers)
    ]

    # Exclude calendars - must be added before the command
    for cal in exclude_calendars:
        cmd.extend(["-ec", cal])

    # Add the date range command at the end
    cmd.append(f"eventsToday+{days_ahead}")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30,
        )

        if result.returncode != 0:
            raise RuntimeError(f"icalBuddy failed: {result.stderr}")

        events = parse_icalbuddy_output(result.stdout)

        # Also get all-day events
        cmd_allday = cmd.copy()
        cmd_allday.remove("-ea")
        cmd_allday.extend(["-oa"])  # Only all-day events

        result_allday = subprocess.run(
            cmd_allday,
            capture_output=True,
            text=True,
            timeout=30,
        )

        if result_allday.returncode == 0:
            allday_events = parse_icalbuddy_output(result_allday.stdout, all_day=True)
            events.extend(allday_events)

        return events

    except subprocess.TimeoutExpired:
        raise RuntimeError("icalBuddy timed out")


def parse_icalbuddy_output(output: str, all_day: bool = False) -> list[dict]:
    """Parse icalBuddy output into event dictionaries.

    With -sc flag, output is grouped by calendar:
    Calendar Name:
    ------------------------
    |||Event Title :: datetime :: location: ... :: notes: ...
    """
    events = []

    if not output.strip():
        return events

    # Strip ANSI escape codes first
    output = strip_ansi(output)

    # Track current calendar name
    current_calendar = None

    # Process line by line to extract calendar headers first
    lines = output.split("\n")
    processed_parts = []

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # Skip empty lines
        if not line:
            i += 1
            continue

        # Skip separator lines (------------------------)
        if line.startswith("---"):
            i += 1
            continue

        # Check if this is a calendar header (ends with : and next line is separator)
        # Calendar headers are like "TG - School Calendar:" or "m736.io:"
        if line.endswith(":") and "|||" not in line and " :: " not in line:
            # This is a calendar header
            current_calendar = line[:-1].strip()
            i += 1
            continue

        # This is event data - collect continuation lines (indented lines for notes)
        event_line = line
        i += 1
        while i < len(lines):
            next_line = lines[i]
            # If it's indented (continuation of notes/location) or empty, append
            if next_line.startswith("       ") or next_line.strip() == "":
                event_line += " " + next_line.strip()
                i += 1
            else:
                break

        # Now we have a complete event line(s), mark with current calendar
        processed_parts.append((current_calendar, event_line))

    # Now parse each event part
    for calendar_name, event_data in processed_parts:
        # Split by ||| to get individual events in this chunk
        event_chunks = event_data.split("|||")

        for chunk in event_chunks:
            chunk = chunk.strip()
            if not chunk:
                continue

            # Split by " :: " to get properties
            props = chunk.split(" :: ")
            if len(props) < 2:
                continue

            event = {
                "title": props[0].strip() if props[0] else "Untitled",
                "all_day": all_day,
                "external_id": None,
                "start_time": None,
                "end_time": None,
                "location": None,
                "notes": None,
                "calendar_name": calendar_name,
            }

            # Parse datetime (second property)
            if len(props) > 1 and props[1]:
                datetime_str = props[1].strip()
                event["start_time"], event["end_time"] = parse_datetime_range(
                    datetime_str, all_day
                )

            # Parse remaining parts - they have prefixes like "location:" or "notes:"
            for prop in props[2:]:
                prop = prop.strip()
                if not prop:
                    continue

                # Check for labeled properties
                prop_lower = prop.lower()
                if prop_lower.startswith("location:"):
                    event["location"] = prop[9:].strip()
                elif prop_lower.startswith("notes:"):
                    event["notes"] = prop[6:].strip()
                elif prop_lower.startswith("uid:"):
                    event["external_id"] = prop[4:].strip()

            # Only include events with valid start time
            if event["start_time"]:
                events.append(event)

    return events


def parse_datetime_range(
    datetime_str: str, all_day: bool = False
) -> tuple[Optional[str], Optional[str]]:
    """Parse datetime string from icalBuddy into start and end ISO strings.

    Handles formats like:
    - "2024-01-15 at 2024-01-15T09:00:00 - 2024-01-15T10:00:00"
    - "2024-01-15T09:00:00 - 2024-01-15T10:00:00"
    - "2024-01-15 at 09:00 - 10:00"
    - "2024-01-15"
    """
    try:
        # Remove the leading date + " at " if present (icalBuddy quirk)
        # Format: "2024-01-15 at 2024-01-15T09:00:00"
        if " at " in datetime_str:
            # Take everything after " at "
            datetime_str = datetime_str.split(" at ", 1)[1].strip()

        if " - " in datetime_str:
            parts = datetime_str.split(" - ", 1)
            start_str = parts[0].strip()
            end_str = parts[1].strip() if len(parts) > 1 else None

            # Parse start time
            start_dt = dateparser.parse(start_str)
            if not start_dt:
                return None, None
            start_iso = start_dt.isoformat()

            # Parse end time
            if end_str:
                end_dt = dateparser.parse(end_str)
                # If parsing failed, it might be just a time like "10:00:00"
                if not end_dt and start_dt:
                    # Try combining with start date
                    try:
                        end_dt = dateparser.parse(f"{start_dt.date()}T{end_str}")
                    except:
                        pass
                end_iso = end_dt.isoformat() if end_dt else None
            else:
                end_iso = None

            return start_iso, end_iso
        else:
            # Single datetime (likely all-day event)
            dt = dateparser.parse(datetime_str)
            if dt:
                return dt.isoformat(), None
            return None, None

    except Exception:
        return None, None


def filter_events(events: list[dict], exclude_keywords: list[str]) -> list[dict]:
    """Filter out events containing excluded keywords in title."""
    if not exclude_keywords:
        return events

    filtered = []
    for event in events:
        title = event.get("title", "").lower()
        if not any(kw.lower() in title for kw in exclude_keywords):
            filtered.append(event)

    return filtered


def sync_to_server(events: list[dict], config: dict) -> dict:
    """
    Sync events to the DateStack server.

    Returns the server response.
    """
    server_url = config["server"]["url"].rstrip("/")
    api_key = config["server"]["api_key"]
    source_name = config["calendar"]["source_name"]

    response = requests.post(
        f"{server_url}/api/events/sync",
        json={
            "source_name": source_name,
            "events": events,
        },
        headers={
            "X-API-Key": api_key,
            "Content-Type": "application/json",
        },
        timeout=30,
    )

    response.raise_for_status()
    return response.json()


def run_sync(force: bool = False) -> dict:
    """
    Run a full calendar sync.

    Returns a dict with sync results.
    """
    config = load_config()
    errors = validate_config(config)
    if errors:
        raise ValueError(f"Configuration errors: {', '.join(errors)}")

    days_ahead = config["calendar"].get("days_ahead", 14)
    exclude_calendars = config["calendar"].get("exclude_calendars", [])
    exclude_keywords = config["calendar"].get("exclude_keywords", [])

    # Get events from icalBuddy
    events = get_events_from_icalbuddy(
        days_ahead=days_ahead,
        exclude_calendars=exclude_calendars,
    )

    # Filter by keywords
    events = filter_events(events, exclude_keywords)

    # Sync to server
    result = sync_to_server(events, config)

    return {
        "events_found": len(events),
        "events_synced": result.get("events_synced", 0),
        "source_name": config["calendar"]["source_name"],
    }
