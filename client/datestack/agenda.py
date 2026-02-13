"""Agenda item management for DateStack client."""

from datetime import date
from typing import Optional
import requests

from .config import load_config, validate_config


class APIError(Exception):
    """Exception for API errors with useful messages."""
    def __init__(self, message: str, status_code: int = None):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def handle_response_error(response: requests.Response) -> None:
    """Check response for errors and raise APIError with useful message."""
    if response.ok:
        return

    status = response.status_code

    # Try to extract error message from JSON response
    error_message = None
    try:
        data = response.json()
        error_message = data.get("error") or data.get("message")
    except (ValueError, KeyError):
        pass

    # Provide helpful messages for common errors
    if status == 401:
        if error_message:
            raise APIError(f"Authentication failed: {error_message}", status)
        raise APIError("Authentication failed: Invalid or missing API key", status)
    elif status == 403:
        raise APIError(f"Access denied: {error_message or 'Insufficient permissions'}", status)
    elif status == 404:
        raise APIError(f"Not found: {error_message or 'Resource does not exist'}", status)
    elif status == 400:
        raise APIError(f"Bad request: {error_message or 'Invalid request'}", status)
    elif status >= 500:
        raise APIError(f"Server error ({status}): {error_message or 'Internal server error'}", status)
    else:
        raise APIError(f"Request failed ({status}): {error_message or response.reason}", status)


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

    try:
        response = requests.get(
            f"{server_url}/api/agenda",
            params={"date": target_date, "include_completed": "true"},
            headers=headers,
            timeout=10,
        )
    except requests.exceptions.ConnectionError:
        raise APIError(f"Connection failed: Could not connect to {server_url}")
    except requests.exceptions.Timeout:
        raise APIError(f"Connection timed out: Server at {server_url} did not respond")

    handle_response_error(response)
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

    try:
        response = requests.post(
            f"{server_url}/api/agenda",
            json={"text": text, "date": target_date},
            headers=headers,
            timeout=10,
        )
    except requests.exceptions.ConnectionError:
        raise APIError(f"Connection failed: Could not connect to {server_url}")
    except requests.exceptions.Timeout:
        raise APIError(f"Connection timed out: Server at {server_url} did not respond")

    handle_response_error(response)
    return response.json()


def complete_item(item_id: int) -> dict:
    """Mark an agenda item as completed."""
    config = load_config()
    errors = validate_config(config)
    if errors:
        raise ValueError(f"Configuration errors: {', '.join(errors)}")

    server_url, headers = get_api_client(config)

    try:
        response = requests.patch(
            f"{server_url}/api/agenda/{item_id}",
            json={"completed": True},
            headers=headers,
            timeout=10,
        )
    except requests.exceptions.ConnectionError:
        raise APIError(f"Connection failed: Could not connect to {server_url}")
    except requests.exceptions.Timeout:
        raise APIError(f"Connection timed out: Server at {server_url} did not respond")

    handle_response_error(response)
    return response.json()


def uncomplete_item(item_id: int) -> dict:
    """Mark an agenda item as not completed."""
    config = load_config()
    errors = validate_config(config)
    if errors:
        raise ValueError(f"Configuration errors: {', '.join(errors)}")

    server_url, headers = get_api_client(config)

    try:
        response = requests.patch(
            f"{server_url}/api/agenda/{item_id}",
            json={"completed": False},
            headers=headers,
            timeout=10,
        )
    except requests.exceptions.ConnectionError:
        raise APIError(f"Connection failed: Could not connect to {server_url}")
    except requests.exceptions.Timeout:
        raise APIError(f"Connection timed out: Server at {server_url} did not respond")

    handle_response_error(response)
    return response.json()


def delete_item(item_id: int) -> None:
    """Delete an agenda item."""
    config = load_config()
    errors = validate_config(config)
    if errors:
        raise ValueError(f"Configuration errors: {', '.join(errors)}")

    server_url, headers = get_api_client(config)

    try:
        response = requests.delete(
            f"{server_url}/api/agenda/{item_id}",
            headers=headers,
            timeout=10,
        )
    except requests.exceptions.ConnectionError:
        raise APIError(f"Connection failed: Could not connect to {server_url}")
    except requests.exceptions.Timeout:
        raise APIError(f"Connection timed out: Server at {server_url} did not respond")

    handle_response_error(response)
