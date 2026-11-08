"""Gmail API integration for OAuth authentication and email retrieval."""

import os
import json
import secrets
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

from dotenv import dotenv_values

from backend.gemini import ENV_FILE


# Gmail API scopes - readonly access to messages and metadata
GMAIL_SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile"
]

# OAuth endpoints
GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"
USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo"

# In-memory state store (in production, use Redis or database)
_oauth_states = {}
_user_tokens = {}


def get_oauth_config() -> dict:
    """Get OAuth configuration from environment."""
    local = dotenv_values(ENV_FILE, interpolate=False)
    client_id = os.environ.get("GMAIL_CLIENT_ID", local.get("GMAIL_CLIENT_ID") or "").strip()
    client_secret = os.environ.get("GMAIL_CLIENT_SECRET", local.get("GMAIL_CLIENT_SECRET") or "").strip()
    redirect_uri = os.environ.get("GMAIL_REDIRECT_URI", local.get("GMAIL_REDIRECT_URI") or "").strip()

    return {
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri
    }


def generate_auth_url(state: Optional[str] = None) -> tuple[str, str]:
    """
    Generate Google OAuth authorization URL.

    Returns:
        Tuple of (auth_url, state)
    """
    config = get_oauth_config()
    if not config["client_id"] or not config["redirect_uri"]:
        raise ValueError("Gmail OAuth not configured. Set GMAIL_CLIENT_ID and GMAIL_REDIRECT_URI in .env")

    if state is None:
        state = secrets.token_urlsafe(32)

    # Store state for validation
    _oauth_states[state] = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "used": False
    }

    params = {
        "client_id": config["client_id"],
        "redirect_uri": config["redirect_uri"],
        "response_type": "code",
        "scope": " ".join(GMAIL_SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
        "include_granted_scopes": "true"
    }

    auth_url = f"{GOOGLE_AUTH_ENDPOINT}?{urllib.parse.urlencode(params)}"
    return auth_url, state


def validate_state(state: str) -> bool:
    """Validate and consume OAuth state parameter."""
    if state not in _oauth_states:
        return False
    if _oauth_states[state]["used"]:
        return False
    _oauth_states[state]["used"] = True
    return True


def exchange_code_for_tokens(auth_code: str, state: str) -> dict:
    """
    Exchange authorization code for access and refresh tokens.

    Returns:
        Dict with access_token, refresh_token, expires_in, token_type
    """
    if not validate_state(state):
        raise ValueError("Invalid or expired OAuth state")

    config = get_oauth_config()
    if not config["client_secret"]:
        raise ValueError("Gmail OAuth not configured. Set GMAIL_CLIENT_SECRET in .env")

    data = urllib.parse.urlencode({
        "code": auth_code,
        "client_id": config["client_id"],
        "client_secret": config["client_secret"],
        "redirect_uri": config["redirect_uri"],
        "grant_type": "authorization_code"
    }).encode()

    request = Request(
        GOOGLE_TOKEN_ENDPOINT,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST"
    )

    try:
        with urlopen(request, timeout=30) as response:
            token_data = json.loads(response.read().decode())
    except HTTPError as e:
        error_body = e.read().decode()
        raise ValueError(f"Token exchange failed: {error_body}")
    except URLError as e:
        raise ValueError(f"Network error during token exchange: {e}")

    # Get user info
    user_info = get_user_info(token_data["access_token"])

    # Store tokens (in production, encrypt and store in database)
    user_id = user_info.get("email", "unknown")
    _user_tokens[user_id] = {
        "access_token": token_data["access_token"],
        "refresh_token": token_data.get("refresh_token"),
        "expires_at": datetime.now(timezone.utc).timestamp() + token_data.get("expires_in", 3600),
        "token_type": token_data.get("token_type", "Bearer"),
        "user_info": user_info,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    return {
        "access_token": token_data["access_token"],
        "refresh_token": token_data.get("refresh_token"),
        "expires_in": token_data.get("expires_in", 3600),
        "token_type": token_data.get("token_type", "Bearer"),
        "user_info": user_info
    }


def get_user_info(access_token: str) -> dict:
    """Get user profile information from Google."""
    request = Request(
        USERINFO_ENDPOINT,
        headers={"Authorization": f"Bearer {access_token}"}
    )
    try:
        with urlopen(request, timeout=10) as response:
            return json.loads(response.read().decode())
    except Exception:
        return {}


def refresh_access_token(refresh_token: str) -> dict:
    """Refresh an expired access token using refresh token."""
    config = get_oauth_config()

    data = urllib.parse.urlencode({
        "client_id": config["client_id"],
        "client_secret": config["client_secret"],
        "refresh_token": refresh_token,
        "grant_type": "refresh_token"
    }).encode()

    request = Request(
        GOOGLE_TOKEN_ENDPOINT,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST"
    )

    try:
        with urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode())
    except HTTPError as e:
        error_body = e.read().decode()
        raise ValueError(f"Token refresh failed: {error_body}")
    except URLError as e:
        raise ValueError(f"Network error during token refresh: {e}")


def get_valid_access_token(user_email: str) -> Optional[str]:
    """Get a valid access token for a user, refreshing if necessary."""
    if user_email not in _user_tokens:
        return None

    token_data = _user_tokens[user_email]
    now = datetime.now(timezone.utc).timestamp()

    # Check if token is expired or about to expire (5 min buffer)
    if now >= token_data["expires_at"] - 300:
        if not token_data.get("refresh_token"):
            return None
        try:
            new_tokens = refresh_access_token(token_data["refresh_token"])
            token_data["access_token"] = new_tokens["access_token"]
            token_data["expires_at"] = now + new_tokens.get("expires_in", 3600)
            if "refresh_token" in new_tokens:
                token_data["refresh_token"] = new_tokens["refresh_token"]
            token_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        except Exception:
            return None

    return token_data["access_token"]


def list_messages(
    access_token: str,
    query: str = "",
    max_results: int = 50,
    page_token: Optional[str] = None,
    label_ids: Optional[list[str]] = None
) -> dict:
    """
    List Gmail messages matching query.

    Args:
        access_token: Valid OAuth access token
        query: Gmail search query (e.g., "is:unread", "from:example.com")
        max_results: Maximum messages to return (max 500)
        page_token: Pagination token
        label_ids: Filter by label IDs (e.g., ["INBOX", "SPAM"])

    Returns:
        Dict with messages list, nextPageToken, resultSizeEstimate
    """
    params = {"maxResults": min(max_results, 500)}
    if query:
        params["q"] = query
    if page_token:
        params["pageToken"] = page_token
    if label_ids:
        params["labelIds"] = label_ids

    url = f"{GMAIL_API_BASE}/messages?{urllib.parse.urlencode(params)}"
    request = Request(url, headers={"Authorization": f"Bearer {access_token}"})

    try:
        with urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode())
    except HTTPError as e:
        if e.code == 401:
            raise ValueError("Access token expired or invalid")
        error_body = e.read().decode()
        raise ValueError(f"Gmail API error: {error_body}")
    except URLError as e:
        raise ValueError(f"Network error: {e}")


def get_message(access_token: str, message_id: str, format: str = "full") -> dict:
    """
    Get a specific Gmail message.

    Args:
        access_token: Valid OAuth access token
        message_id: Gmail message ID
        format: "full", "metadata", "minimal", or "raw"

    Returns:
        Gmail message resource
    """
    url = f"{GMAIL_API_BASE}/messages/{message_id}?format={format}"
    request = Request(url, headers={"Authorization": f"Bearer {access_token}"})

    try:
        with urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode())
    except HTTPError as e:
        if e.code == 401:
            raise ValueError("Access token expired or invalid")
        error_body = e.read().decode()
        raise ValueError(f"Gmail API error: {error_body}")
    except URLError as e:
        raise ValueError(f"Network error: {e}")


def get_message_raw(access_token: str, message_id: str) -> str:
    """Get raw RFC822 message content."""
    message = get_message(access_token, message_id, format="raw")
    raw_data = message.get("raw", "")
    if raw_data:
        import base64
        return base64.urlsafe_b64decode(raw_data + "=" * (-len(raw_data) % 4)).decode("utf-8", errors="replace")
    return ""


def parse_gmail_message(message: dict) -> dict:
    """
    Parse Gmail message resource into structured format.

    Returns dict with: id, thread_id, label_ids, snippet, headers, body_text, body_html, attachments
    """
    payload = message.get("payload", {})
    headers = {h["name"]: h["value"] for h in payload.get("headers", [])}

    # Extract body parts
    body_text = ""
    body_html = ""
    attachments = []

    def extract_parts(part: dict):
        nonlocal body_text, body_html
        mime_type = part.get("mimeType", "")
        body = part.get("body", {})
        data = body.get("data", "")
        filename = part.get("filename", "")
        part_headers = {h["name"]: h["value"] for h in part.get("headers", [])}

        if data:
            import base64
            try:
                decoded = base64.urlsafe_b64decode(data + "=" * (-len(data) % 4)).decode("utf-8", errors="replace")
            except Exception:
                decoded = ""

            if mime_type == "text/plain" and not filename:
                body_text += decoded
            elif mime_type == "text/html" and not filename:
                body_html += decoded
            elif filename or body.get("attachmentId"):
                attachments.append({
                    "filename": filename,
                    "mime_type": mime_type,
                    "size": body.get("size", 0),
                    "attachment_id": body.get("attachmentId"),
                    "headers": part_headers
                })

        # Recurse into parts
        for subpart in part.get("parts", []):
            extract_parts(subpart)

    extract_parts(payload)

    # Parse key headers
    from_header = headers.get("From", "")
    to_header = headers.get("To", "")
    subject = headers.get("Subject", "")
    date_header = headers.get("Date", "")
    message_id = headers.get("Message-ID", "")
    return_path = headers.get("Return-Path", "")
    reply_to = headers.get("Reply-To", "")
    sender = headers.get("Sender", "")
    received = headers.get("Received", "")

    return {
        "id": message.get("id"),
        "thread_id": message.get("threadId"),
        "label_ids": message.get("labelIds", []),
        "snippet": message.get("snippet", ""),
        "headers": {
            "from": from_header,
            "to": to_header,
            "subject": subject,
            "date": date_header,
            "message_id": message_id,
            "return_path": return_path,
            "reply_to": reply_to,
            "sender": sender,
            "received": received,
            "all": headers
        },
        "body_text": body_text.strip(),
        "body_html": body_html.strip(),
        "attachments": attachments,
        "internal_date": message.get("internalDate"),
        "size_estimate": message.get("sizeEstimate")
    }


def get_attachment(access_token: str, message_id: str, attachment_id: str) -> bytes:
    """Download an attachment by ID."""
    url = f"{GMAIL_API_BASE}/messages/{message_id}/attachments/{attachment_id}"
    request = Request(url, headers={"Authorization": f"Bearer {access_token}"})

    try:
        with urlopen(request, timeout=30) as response:
            data = json.loads(response.read().decode())
            import base64
            return base64.urlsafe_b64decode(data["data"] + "=" * (-len(data["data"]) % 4))
    except HTTPError as e:
        if e.code == 401:
            raise ValueError("Access token expired or invalid")
        error_body = e.read().decode()
        raise ValueError(f"Gmail API error: {error_body}")
    except URLError as e:
        raise ValueError(f"Network error: {e}")


def get_user_labels(access_token: str) -> list[dict]:
    """Get user's Gmail labels."""
    url = f"{GMAIL_API_BASE}/labels"
    request = Request(url, headers={"Authorization": f"Bearer {access_token}"})

    try:
        with urlopen(request, timeout=30) as response:
            data = json.loads(response.read().decode())
            return data.get("labels", [])
    except HTTPError as e:
        if e.code == 401:
            raise ValueError("Access token expired or invalid")
        error_body = e.read().decode()
        raise ValueError(f"Gmail API error: {error_body}")
    except URLError as e:
        raise ValueError(f"Network error: {e}")


def revoke_user_tokens(user_email: str) -> bool:
    """Revoke stored tokens for a user (logout)."""
    if user_email in _user_tokens:
        del _user_tokens[user_email]
        return True
    return False


def get_stored_user_info(user_email: str) -> Optional[dict]:
    """Get stored user info without making API call."""
    if user_email in _user_tokens:
        return _user_tokens[user_email].get("user_info")
    return None