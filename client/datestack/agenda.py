"""Agenda item management for DateStack client."""

from datetime import date
from typing import Optional
import requests

from .config import load_config, validate_config


def get_api_client(config: dict) -> tuple[str, dict]:
    """Get the base URL and headers for API requests."""
    server_url = config["server"]["url"].rstrip("/")
    headers = {
        "X-API-Key": config["server"]["api_key"],
        "Content-Type": "application/json",
    }
    return server_url, headers


def list_items(target_date: Optional[str] = None) -> list[dict]:
    """
    List agenda items for a date.

    Args:
        target_date: Date string (YYYY-MM-DD), defaults to today
    """
    config = load_config()
    errors = validate_config(config)
    if errors:
        raise ValueError(f"Configuration errors: {', '.join(errors)}")

    if target_date is None:
        target_date = date.today().isoformat()

    server_url, headers = get_api_client(config)

    response = requests.get(
        f"{server_url}/api/agenda",
        params={"date": target_date, "include_completed": "true"},
        headers=headers,
        timeout=10,
    )
    response.raise_for_status()
    return response.json()


def add_item(text: str, target_date: Optional[str] = None) -> dict:
    """
    Add a new agenda item.

    Args:
        text: The task text
        target_date: Date string (YYYY-MM-DD), defaults to today
    """
    config = load_config()
    errors = validate_config(config)
    if errors:
        raise ValueError(f"Configuration errors: {', '.join(errors)}")

    if target_date is None:
        target_date = date.today().isoformat()

    server_url, headers = get_api_client(config)

    response = requests.post(
        f"{server_url}/api/agenda",
        json={"text": text, "date": target_date},
        headers=headers,
        timeout=10,
    )
    response.raise_for_status()
    return response.json()


def complete_item(item_id: int) -> dict:
    """Mark an agenda item as completed."""
    config = load_config()
    errors = validate_config(config)
    if errors:
        raise ValueError(f"Configuration errors: {', '.join(errors)}")

    server_url, headers = get_api_client(config)

    response = requests.patch(
        f"{server_url}/api/agenda/{item_id}",
        json={"completed": True},
        headers=headers,
        timeout=10,
    )
    response.raise_for_status()
    return response.json()


def uncomplete_item(item_id: int) -> dict:
    """Mark an agenda item as not completed."""
    config = load_config()
    errors = validate_config(config)
    if errors:
        raise ValueError(f"Configuration errors: {', '.join(errors)}")

    server_url, headers = get_api_client(config)

    response = requests.patch(
        f"{server_url}/api/agenda/{item_id}",
        json={"completed": False},
        headers=headers,
        timeout=10,
    )
    response.raise_for_status()
    return response.json()


def delete_item(item_id: int) -> None:
    """Delete an agenda item."""
    config = load_config()
    errors = validate_config(config)
    if errors:
        raise ValueError(f"Configuration errors: {', '.join(errors)}")

    server_url, headers = get_api_client(config)

    response = requests.delete(
        f"{server_url}/api/agenda/{item_id}",
        headers=headers,
        timeout=10,
    )
    response.raise_for_status()
