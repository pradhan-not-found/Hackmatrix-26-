"""Encrypted per-user Gmail connections and passive inbox fraud screening."""

import base64
import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Optional
from uuid import NAMESPACE_URL, uuid5

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from backend.email_analysis import MAX_EMAIL_SIZE, analyze_email
from backend.gmail_api import get_message, get_oauth_config, list_messages, parse_gmail_message, refresh_access_token

SCAN_LIMIT = 15
FLAGGED = {"PHISHING", "SCAM", "SUSPICIOUS"}
_CACHE_LIMIT = 2000
_scan_cache: dict[tuple[str, str], dict] = {}


class GmailReconnectRequired(Exception):
    """The stored Google authorization is missing, expired or was revoked."""


def _database() -> sqlite3.Connection:
    path = Path(os.getenv("EMAIL_ANALYSIS_DB", "data/email_analyses.sqlite3"))
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=5)
    connection.execute("""CREATE TABLE IF NOT EXISTS gmail_connections (
        user_id TEXT PRIMARY KEY, email TEXT NOT NULL, tokens BLOB NOT NULL, connected_at TEXT NOT NULL
    )""")
    return connection


def _cipher() -> Fernet:
    secret = get_oauth_config()["client_secret"]
    if not secret:
        raise ValueError("Gmail OAuth not configured. Set GMAIL_CLIENT_SECRET in .env")
    key = HKDF(algorithm=hashes.SHA256(), length=32, salt=None, info=b"webassure-gmail-tokens-v1").derive(secret.encode())
    return Fernet(base64.urlsafe_b64encode(key))


def _write_tokens(user_id: str, email: str, tokens: dict, connected_at: str) -> None:
    sealed = _cipher().encrypt(json.dumps(tokens).encode())
    connection = _database()
    try:
        with connection:
            connection.execute(
                "INSERT INTO gmail_connections (user_id, email, tokens, connected_at) VALUES (?, ?, ?, ?) "
                "ON CONFLICT(user_id) DO UPDATE SET email = excluded.email, tokens = excluded.tokens, connected_at = excluded.connected_at",
                (user_id, email, sealed, connected_at),
            )
    finally:
        connection.close()


def _read(user_id: str) -> Optional[tuple[str, dict, str]]:
    connection = _database()
    try:
        row = connection.execute("SELECT email, tokens, connected_at FROM gmail_connections WHERE user_id = ?", (user_id,)).fetchone()
    finally:
        connection.close()
    if not row:
        return None
    try:
        return row[0], json.loads(_cipher().decrypt(row[1])), row[2]
    except (InvalidToken, ValueError):
        return None


def save_connection(user_id: str, tokens: dict) -> None:
    previous = _read(user_id)
    stored = {
        "access_token": tokens["access_token"],
        "refresh_token": tokens.get("refresh_token") or (previous[1].get("refresh_token") if previous else None),
        "expires_at": datetime.now(timezone.utc).timestamp() + tokens.get("expires_in", 3600),
    }
    email = (tokens.get("user_info") or {}).get("email") or "Gmail account"
    _write_tokens(user_id, email, stored, datetime.now(timezone.utc).isoformat())
    forget_cached(user_id)


def connection_status(user_id: str) -> dict:
    current = _read(user_id)
    if not current:
        return {"connected": False}
    return {"connected": True, "email": current[0], "connected_at": current[2]}


def stored_tokens(user_id: str) -> Optional[dict]:
    current = _read(user_id)
    return current[1] if current else None


def delete_connection(user_id: str) -> bool:
    connection = _database()
    try:
        with connection:
            removed = connection.execute("DELETE FROM gmail_connections WHERE user_id = ?", (user_id,)).rowcount
    finally:
        connection.close()
    forget_cached(user_id)
    return bool(removed)


def forget_cached(user_id: str) -> None:
    for key in [key for key in _scan_cache if key[0] == user_id]:
        del _scan_cache[key]


def access_token_for(user_id: str) -> str:
    """Return a current access token for this WebAssure user, refreshing it when needed."""
    current = _read(user_id)
    if not current:
        raise GmailReconnectRequired("Connect Gmail in Settings first.")
    email, tokens, connected_at = current
    now = datetime.now(timezone.utc).timestamp()
    if now < tokens.get("expires_at", 0) - 300:
        return tokens["access_token"]
    if not tokens.get("refresh_token"):
        raise GmailReconnectRequired("Your Gmail connection expired. Reconnect it in Settings.")
    try:
        fresh = refresh_access_token(tokens["refresh_token"])
    except ValueError as failure:
        raise GmailReconnectRequired("Your Gmail connection expired. Reconnect it in Settings.") from failure
    tokens.update(access_token=fresh["access_token"], expires_at=now + fresh.get("expires_in", 3600))
    if fresh.get("refresh_token"):
        tokens["refresh_token"] = fresh["refresh_token"]
    _write_tokens(user_id, email, tokens, connected_at)
    return tokens["access_token"]


def email_source(parsed: dict) -> str:
    """Rebuild a bounded text message that the existing analyzer can parse."""
    lines = []
    for name, value in parsed["headers"]["all"].items():
        lines.append(f"{name}: {' '.join(str(value).split())}")
    body = parsed["body_text"]
    if parsed["body_html"]:
        body += "\n\n" + parsed["body_html"]
    source = "\n".join(lines) + "\n\n" + body
    return source.encode("utf-8")[:MAX_EMAIL_SIZE - 1024].decode("utf-8", errors="ignore")


def _screen(user_id: str, access_token: str, message_id: str, save_report: Optional[Callable[[str, dict], None]]) -> dict:
    parsed = parse_gmail_message(get_message(access_token, message_id, format="full"))
    # Background screening must never open links: they can be one-time logins or unsubscribes.
    report = analyze_email(email_source(parsed), "text", use_gemini=False, follow_links=False)
    # A stable ID keeps repeat scans from adding the same email to the user's history twice.
    report.update(id=str(uuid5(NAMESPACE_URL, f"gmail:{user_id}:{message_id}")), source="gmail", gmail_message_id=message_id)
    if save_report and report["classification"] in FLAGGED:
        save_report(user_id, report)
    reasons = report.get("risk_scoring", {}).get("reasons") or [item.get("evidence") for item in report.get("indicators", [])]
    return {
        "id": message_id,
        "report_id": report["id"],
        "from": report.get("sender") or parsed["headers"]["from"],
        "subject": report.get("subject") or parsed["headers"]["subject"] or "(no subject)",
        "date": parsed["headers"]["date"],
        "classification": report["classification"],
        "risk_score": report["risk_score"],
        "reasons": [str(reason)[:160] for reason in reasons if reason][:3],
    }


def scan_inbox(user_id: str, limit: int = SCAN_LIMIT, save_report: Optional[Callable[[str, dict], None]] = None) -> dict:
    """Screen the newest inbox messages. Only flagged messages' summaries are returned."""
    status = connection_status(user_id)
    access_token = access_token_for(user_id)
    try:
        listing = list_messages(access_token, "in:inbox", limit)
    except ValueError as failure:
        if "expired" in str(failure).lower() or "invalid" in str(failure).lower():
            raise GmailReconnectRequired("Your Gmail connection expired. Reconnect it in Settings.") from failure
        raise
    entries, failed = [], 0
    for item in listing.get("messages", [])[:limit]:
        key = (user_id, item["id"])
        try:
            if key not in _scan_cache:
                if len(_scan_cache) >= _CACHE_LIMIT:
                    _scan_cache.clear()
                _scan_cache[key] = _screen(user_id, access_token, item["id"], save_report)
            entries.append(_scan_cache[key])
        except (ValueError, KeyError, UnicodeError):
            failed += 1
    return {
        "email": status.get("email"),
        "scanned": len(entries),
        "failed": failed,
        "flagged": [entry for entry in entries if entry["classification"] in FLAGGED],
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }
