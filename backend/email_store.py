"""Private email history and encrypted Gmail connections.

Local development keeps SQLite files. Vercel has no durable disk, so deployments
store the same records in Supabase under the signed-in user's row-level security.
"""

import json
import os
import sqlite3
from pathlib import Path
from typing import Optional
from urllib.parse import urlencode

from fastapi import HTTPException

from backend.supabase import request_supabase

SUMMARY_FIELDS = ("id", "classification", "risk_score", "sender", "subject", "analyzed_at")


def using_supabase() -> bool:
    chosen = os.getenv("EMAIL_STORE", "").strip().lower()
    return chosen == "supabase" if chosen else bool(os.getenv("VERCEL"))


def _database() -> sqlite3.Connection:
    path = Path(os.getenv("EMAIL_ANALYSIS_DB", "data/email_analyses.sqlite3"))
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=5)
    connection.execute("CREATE TABLE IF NOT EXISTS email_analyses (id TEXT PRIMARY KEY, report TEXT NOT NULL, created_at TEXT NOT NULL)")
    # Legacy rows have no owner and must never be assigned to whoever signs in
    # first. Keep them intact, and store dashboard reports in an owner-scoped table.
    connection.execute("""CREATE TABLE IF NOT EXISTS user_email_analyses (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, report TEXT NOT NULL, created_at TEXT NOT NULL
    )""")
    connection.execute("CREATE INDEX IF NOT EXISTS user_email_history ON user_email_analyses(user_id, created_at DESC)")
    connection.execute("""CREATE TABLE IF NOT EXISTS gmail_connections (
        user_id TEXT PRIMARY KEY, email TEXT NOT NULL, tokens BLOB NOT NULL, connected_at TEXT NOT NULL
    )""")
    return connection


def _session(session: Optional[str]) -> str:
    if not session:
        raise HTTPException(401, "Your session has expired. Sign in again.")
    return session


def _query(table: str, **params) -> str:
    return f"/rest/v1/{table}?" + urlencode(params)


def save_analysis(user_id: str, session: Optional[str], report: dict, ignore_duplicate: bool = False) -> None:
    if using_supabase():
        prefer = "return=minimal,resolution=ignore-duplicates" if ignore_duplicate else "return=minimal"
        path = "/rest/v1/email_analyses" + ("?on_conflict=id" if ignore_duplicate else "")
        request_supabase(path, _session(session), "POST",
                         {"id": report["id"], "user_id": user_id, "report": report, "created_at": report["analyzed_at"]},
                         {"Prefer": prefer})
        return
    verb = "INSERT OR IGNORE" if ignore_duplicate else "INSERT"
    connection = _database()
    try:
        with connection:
            connection.execute(f"{verb} INTO user_email_analyses (id, user_id, report, created_at) VALUES (?, ?, ?, ?)",
                               (report["id"], user_id, json.dumps(report), report["analyzed_at"]))
    finally:
        connection.close()


def get_analysis(user_id: str, session: Optional[str], analysis_id: str) -> Optional[dict]:
    if using_supabase():
        rows, _ = request_supabase(_query("email_analyses", user_id=f"eq.{user_id}", id=f"eq.{analysis_id}", select="report", limit=1),
                                   _session(session))
        return rows[0]["report"] if rows else None
    connection = _database()
    try:
        row = connection.execute("SELECT report FROM user_email_analyses WHERE id = ? AND user_id = ?", (analysis_id, user_id)).fetchone()
    finally:
        connection.close()
    return json.loads(row[0]) if row else None


def list_analyses(user_id: str, session: Optional[str], limit: int, offset: int) -> dict:
    if using_supabase():
        select = ("id,classification:report->>classification,risk_score:report->risk_score,"
                  "sender:report->>sender,subject:report->>subject,analyzed_at:report->>analyzed_at")
        rows, headers = request_supabase(
            _query("email_analyses", user_id=f"eq.{user_id}", select=select, order="created_at.desc,id.desc", limit=limit, offset=offset),
            _session(session), extra_headers={"Prefer": "count=exact"})
        try:
            total = int(headers["Content-Range"].rsplit("/", 1)[1])
        except (KeyError, ValueError) as failure:
            raise HTTPException(502, "Supabase returned invalid pagination metadata.") from failure
        return {"items": rows, "total": total}
    connection = _database()
    try:
        rows = connection.execute(
            "SELECT report FROM user_email_analyses WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
            (user_id, limit, offset)).fetchall()
        total = connection.execute("SELECT COUNT(*) FROM user_email_analyses WHERE user_id = ?", (user_id,)).fetchone()[0]
    finally:
        connection.close()
    items = [{key: report.get(key) for key in SUMMARY_FIELDS} for report in (json.loads(row[0]) for row in rows)]
    return {"items": items, "total": total}


def read_connection(user_id: str, session: Optional[str]) -> Optional[tuple[str, bytes, str]]:
    """Return the stored (email, encrypted tokens, connected_at) for this user."""
    if using_supabase():
        rows, _ = request_supabase(_query("gmail_connections", user_id=f"eq.{user_id}", select="email,tokens,connected_at", limit=1),
                                   _session(session))
        return (rows[0]["email"], rows[0]["tokens"].encode(), rows[0]["connected_at"]) if rows else None
    connection = _database()
    try:
        row = connection.execute("SELECT email, tokens, connected_at FROM gmail_connections WHERE user_id = ?", (user_id,)).fetchone()
    finally:
        connection.close()
    return (row[0], row[1], row[2]) if row else None


def write_connection(user_id: str, session: Optional[str], email: str, sealed: bytes, connected_at: str) -> None:
    if using_supabase():
        request_supabase("/rest/v1/gmail_connections?on_conflict=user_id", _session(session), "POST",
                         {"user_id": user_id, "email": email, "tokens": sealed.decode(), "connected_at": connected_at},
                         {"Prefer": "return=minimal,resolution=merge-duplicates"})
        return
    connection = _database()
    try:
        with connection:
            connection.execute(
                "INSERT INTO gmail_connections (user_id, email, tokens, connected_at) VALUES (?, ?, ?, ?) "
                "ON CONFLICT(user_id) DO UPDATE SET email = excluded.email, tokens = excluded.tokens, connected_at = excluded.connected_at",
                (user_id, email, sealed, connected_at))
    finally:
        connection.close()


def delete_connection(user_id: str, session: Optional[str]) -> bool:
    if using_supabase():
        rows, _ = request_supabase(_query("gmail_connections", user_id=f"eq.{user_id}", select="user_id"), _session(session), "DELETE",
                                   extra_headers={"Prefer": "return=representation"})
        return bool(rows)
    connection = _database()
    try:
        with connection:
            removed = connection.execute("DELETE FROM gmail_connections WHERE user_id = ?", (user_id,)).rowcount
    finally:
        connection.close()
    return bool(removed)
