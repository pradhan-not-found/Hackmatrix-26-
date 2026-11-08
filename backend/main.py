import json
import os
import sqlite3
import threading
from pathlib import Path
from uuid import UUID
from typing import Literal, Optional

from fastapi import Depends, FastAPI, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import HTMLResponse
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field, model_validator

from backend.investigation import investigate
from backend.network import UnsafeURL
from backend.gemini import explain, explain_message_analysis, saved_insights_match
from backend.explanation import explain_locally
from backend.message_analysis import MAX_MESSAGE_LENGTH, analyze_message
from backend.supabase import investigation_store, authenticated_user, Principal
from backend.email_analysis import analyze_email, MAX_EMAIL_SIZE
from backend.gmail_api import (
    generate_auth_url, exchange_code_for_tokens,
    list_messages, get_message, parse_gmail_message, revoke_token
)
from backend.gmail_connections import (
    GmailReconnectRequired, access_token_for, connection_status, delete_connection,
    email_source, save_connection, scan_inbox, stored_tokens
)

app = FastAPI(title="HackMatrix URL Investigation", version="0.1.0")
# Bound simultaneous outbound scans in this single-process MVP.
slots = threading.BoundedSemaphore(4)
explanation_locks = [threading.Lock() for _ in range(32)]


def database():
    """Legacy SQLite access for offline fixtures/export; the API uses Supabase."""
    path = Path(os.getenv("INVESTIGATION_DB", "data/investigations.sqlite3"))
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=5)
    connection.execute("CREATE TABLE IF NOT EXISTS investigations (id TEXT PRIMARY KEY, report TEXT NOT NULL)")
    return connection


class InvestigationRequest(BaseModel):
    url: str = Field(min_length=1, max_length=4096)


class MessageAnalysisRequest(BaseModel):
    message: str = Field(max_length=MAX_MESSAGE_LENGTH)


class EmailAnalysisRequest(BaseModel):
    """Submit either a complete raw message or headers copied from a message."""
    email_content: Optional[str] = Field(default=None, max_length=MAX_EMAIL_SIZE,
                                         description="Complete RFC 5322 email, including headers and optional body")
    raw_headers: Optional[str] = Field(default=None, max_length=MAX_EMAIL_SIZE,
                                       description="Raw RFC 5322 headers, with one header per line")
    use_gemini: bool = False

    @model_validator(mode="after")
    def require_one_input(self):
        if bool(self.email_content and self.email_content.strip()) == bool(self.raw_headers and self.raw_headers.strip()):
            raise ValueError("Provide exactly one of email_content or raw_headers")
        return self


class EmailAnalysisResponse(BaseModel):
    """Stable top-level response contract; nested evidence remains extensible."""
    id: str
    analyzed_at: str
    classification: Literal["SAFE", "SUSPICIOUS", "SCAM", "PHISHING"]
    risk_score: int = Field(ge=0, le=100)
    risk_scoring: dict
    sender: str
    subject: str
    indicators: list[dict]
    authentication: dict
    urls: list[dict]
    attachments: list[dict]
    content_analysis: dict
    sender_analysis: dict
    recommendations: list[str]
    limitations: list[str]
    ai_explanation: dict


class GmailAnalyzeRequest(BaseModel):
    message_ids: list[str]
    use_gemini: bool = False


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/analyze-message")
def create_message_analysis(body: MessageAnalysisRequest,
                            provider: Literal["local", "gemini"] = "local"):
    try:
        report = analyze_message(body.message)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    if provider == "gemini":
        report["ai_explanation"] = explain_message_analysis(report)
    return report


@app.post("/api/investigations", status_code=201)
def create_investigation(body: InvestigationRequest, store=Depends(investigation_store)):
    if not slots.acquire(blocking=False):
        raise HTTPException(429, "Investigation capacity reached; retry later")
    try:
        try:
            report = investigate(body.url)
        except UnsafeURL as exc:
            raise HTTPException(422, str(exc)) from exc
        store.create(report)
        return report
    finally:
        slots.release()


@app.get("/api/investigations")
def list_investigations(limit: int = Query(default=30, ge=1, le=100),
                        offset: int = Query(default=0, ge=0), store=Depends(investigation_store)):
    return store.list(limit, offset)


@app.get("/api/investigations/{investigation_id}")
def get_investigation(investigation_id: UUID, store=Depends(investigation_store)):
    return store.get(str(investigation_id))


@app.post("/api/investigations/{investigation_id}/explanation")
def explain_investigation(investigation_id: UUID, provider: Literal["local", "gemini"] = "local", store=Depends(investigation_store)):
    # Coalesce duplicate requests in this single-process MVP, then recheck storage.
    with explanation_locks[investigation_id.int % len(explanation_locks)]:
        return _explain_investigation(investigation_id, provider, store)


def _explain_investigation(investigation_id, provider, store):
    report = store.get(str(investigation_id))
    if provider == 'gemini' and saved_insights_match(report):
        return report['ai_explanation']
    if not slots.acquire(blocking=False):
        raise HTTPException(429, "Investigation capacity reached; retry later")
    try:
        explanation = explain(report) if provider == "gemini" else explain_locally(report)
        if explanation.get('status') != 'completed':
            return explanation  # Keep the saved local explanation on provider failure.
        report["ai_explanation"] = explanation
        store.update(str(investigation_id), report)
        return report["ai_explanation"]
    finally:
        slots.release()


def email_database():
    """Database for email analyses."""
    path = Path(os.getenv("EMAIL_ANALYSIS_DB", "data/email_analyses.sqlite3"))
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=5)
    connection.execute("""
        CREATE TABLE IF NOT EXISTS email_analyses (
            id TEXT PRIMARY KEY,
            report TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)
    # Legacy rows have no owner and must never be assigned to whoever signs in
    # first. Keep them intact, and store dashboard reports in an owner-scoped table.
    connection.execute("""CREATE TABLE IF NOT EXISTS user_email_analyses (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, report TEXT NOT NULL, created_at TEXT NOT NULL
    )""")
    connection.execute("CREATE INDEX IF NOT EXISTS user_email_history ON user_email_analyses(user_id, created_at DESC)")
    return connection


# Email Analysis Endpoints

@app.post("/api/email/analyze", response_model=EmailAnalysisResponse,
          summary="Analyze pasted email text or raw headers",
          description="Provide exactly one of email_content (complete raw message) or raw_headers (header block only). Authentication evidence is reported separately from missing evidence.")
def analyze_email_text(body: EmailAnalysisRequest, principal: Principal = Depends(authenticated_user)):
    """Analyze a complete pasted message or a header-only sample."""
    if not slots.acquire(blocking=False):
        raise HTTPException(429, "Analysis capacity reached; retry later")
    try:
        try:
            source = body.email_content if body.email_content is not None else body.raw_headers
            report = analyze_email(source, "text", body.use_gemini)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc

        # Store in database
        connection = email_database()
        try:
            with connection:
                connection.execute(
                    "INSERT INTO user_email_analyses (id, user_id, report, created_at) VALUES (?, ?, ?, ?)",
                    (report["id"], principal.id, json.dumps(report), report["analyzed_at"])
                )
        finally:
            connection.close()

        return report
    finally:
        slots.release()


@app.post("/api/email/upload", response_model=EmailAnalysisResponse,
          summary="Analyze a raw .eml file")
async def analyze_email_upload(
    file: UploadFile = File(...),
    use_gemini: bool = Form(False),
    principal: Principal = Depends(authenticated_user)
):
    """Analyze uploaded .eml file."""
    if not slots.acquire(blocking=False):
        raise HTTPException(429, "Analysis capacity reached; retry later")

    try:
        if not file.filename or not file.filename.lower().endswith(".eml"):
            raise HTTPException(422, "Only .eml files are supported")
        content = await file.read(MAX_EMAIL_SIZE + 1)
        if len(content) > MAX_EMAIL_SIZE:
            raise HTTPException(422, f"File exceeds maximum size of {MAX_EMAIL_SIZE} bytes")
        try:
            report = await run_in_threadpool(analyze_email, content, "eml", use_gemini)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc

        # Store in database
        connection = email_database()
        try:
            with connection:
                connection.execute(
                    "INSERT INTO user_email_analyses (id, user_id, report, created_at) VALUES (?, ?, ?, ?)",
                    (report["id"], principal.id, json.dumps(report), report["analyzed_at"])
                )
        finally:
            connection.close()

        return report
    finally:
        slots.release()


@app.get("/api/email/results/{analysis_id}")
def get_email_analysis(analysis_id: UUID, principal: Principal = Depends(authenticated_user)):
    """Retrieve a stored email analysis report."""
    connection = email_database()
    try:
        row = connection.execute(
            "SELECT report FROM user_email_analyses WHERE id = ? AND user_id = ?",
            (str(analysis_id), principal.id)
        ).fetchone()
    finally:
        connection.close()

    if row is None:
        raise HTTPException(404, "Email analysis not found")
    return json.loads(row[0])


@app.get("/api/email/results")
def list_email_analyses(
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    principal: Principal = Depends(authenticated_user)
):
    """List stored email analyses."""
    connection = email_database()
    try:
        rows = connection.execute(
            "SELECT report FROM user_email_analyses WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
            (principal.id, limit, offset)
        ).fetchall()
        total = connection.execute("SELECT COUNT(*) FROM user_email_analyses WHERE user_id = ?", (principal.id,)).fetchone()[0]
    finally:
        connection.close()

    fields = ("id", "classification", "risk_score", "sender", "subject", "analyzed_at")
    items = [{key: report.get(key) for key in fields}
             for report in (json.loads(row[0]) for row in rows)]
    return {"items": items, "total": total, "limit": limit, "offset": offset}


# Gmail OAuth Endpoints. Every route except Google's callback requires a signed-in user,
# and the callback only accepts a single-use state created for that user.

def gmail_page(connected: bool) -> HTMLResponse:
    heading, detail = ("Gmail connected", "You can close this window and return to WebAssure.") if connected else \
        ("Gmail could not be connected", "Close this window and try again from WebAssure.")
    return HTMLResponse(
        f"<!doctype html><meta charset=utf-8><title>{heading}</title>"
        f"<body style=\"font:16px system-ui;display:grid;place-items:center;height:90vh;text-align:center\">"
        f"<div><h1 style=\"font-size:22px\">{heading}</h1><p>{detail}</p></div>"
        f"<script>{'setTimeout(function(){window.close()},900)' if connected else ''}</script>",
        headers={"Cache-Control": "no-store"})


def save_gmail_report(user_id: str, report: dict) -> None:
    """Add a flagged inbox email to the same private history as manual analyses."""
    connection = email_database()
    try:
        with connection:
            connection.execute(
                "INSERT OR IGNORE INTO user_email_analyses (id, user_id, report, created_at) VALUES (?, ?, ?, ?)",
                (report["id"], user_id, json.dumps(report), report["analyzed_at"]))
    finally:
        connection.close()


def gmail_call(action):
    """Run a Gmail API action, translating failures without exposing Google's response."""
    try:
        return action()
    except GmailReconnectRequired as exc:
        raise HTTPException(409, str(exc)) from exc
    except ValueError as exc:
        if "expired" in str(exc).lower() or "invalid" in str(exc).lower():
            raise HTTPException(409, "Your Gmail connection expired. Reconnect it in Settings.") from exc
        raise HTTPException(502, "Gmail is unavailable right now. Please retry.") from exc


@app.get("/api/email/gmail/auth")
def gmail_auth(principal: Principal = Depends(authenticated_user)):
    """Start Gmail OAuth for the signed-in user."""
    try:
        auth_url, _ = generate_auth_url(principal.id)
        return {"auth_url": auth_url}
    except ValueError as exc:
        raise HTTPException(503, str(exc)) from exc


@app.get("/api/email/gmail/callback", response_class=HTMLResponse)
def gmail_callback(code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None):
    """Finish Gmail OAuth. The connection is stored for the user bound to the state."""
    if error or not code or not state:
        return gmail_page(False)
    try:
        owner_id, tokens = exchange_code_for_tokens(code, state)
        if not owner_id or not tokens:
            return gmail_page(False)
        save_connection(owner_id, tokens)
        return gmail_page(True)
    except (ValueError, KeyError):
        return gmail_page(False)


@app.get("/api/email/gmail/status")
def gmail_status(principal: Principal = Depends(authenticated_user)):
    """Report the signed-in user's own Gmail connection."""
    return connection_status(principal.id)


@app.post("/api/email/gmail/scan")
def gmail_scan(principal: Principal = Depends(authenticated_user)):
    """Screen the signed-in user's newest inbox messages without opening their links."""
    if not slots.acquire(blocking=False):
        raise HTTPException(429, "Analysis capacity reached; retry later")
    try:
        return gmail_call(lambda: scan_inbox(principal.id, save_report=save_gmail_report))
    finally:
        slots.release()


@app.get("/api/email/gmail/messages")
def gmail_list_messages(
    query: str = "",
    max_results: int = Query(default=50, ge=1, le=100),
    page_token: Optional[str] = None,
    principal: Principal = Depends(authenticated_user)
):
    """List the signed-in user's Gmail messages."""
    return gmail_call(lambda: list_messages(access_token_for(principal.id), query, max_results, page_token))


@app.get("/api/email/gmail/message/{message_id}")
def gmail_get_message(message_id: str, principal: Principal = Depends(authenticated_user)):
    """Get one of the signed-in user's Gmail messages."""
    return gmail_call(lambda: parse_gmail_message(get_message(access_token_for(principal.id), message_id, format="full")))


@app.post("/api/email/gmail/analyze")
def gmail_analyze_messages(body: GmailAnalyzeRequest, principal: Principal = Depends(authenticated_user)):
    """Analyze selected messages from the signed-in user's Gmail."""
    if not slots.acquire(blocking=False):
        raise HTTPException(429, "Analysis capacity reached; retry later")

    def analyze():
        access_token = access_token_for(principal.id)
        results = []
        for msg_id in body.message_ids[:10]:
            try:
                parsed = parse_gmail_message(get_message(access_token, msg_id, format="full"))
                report = analyze_email(email_source(parsed), "text", body.use_gemini, follow_links=False)
                report["gmail_message_id"] = msg_id
                results.append(report)
            except ValueError:
                results.append({"gmail_message_id": msg_id, "error": "This message could not be analyzed."})
        return {"results": results, "analyzed": len(results)}

    try:
        return gmail_call(analyze)
    finally:
        slots.release()


@app.post("/api/email/gmail/disconnect")
def gmail_disconnect(principal: Principal = Depends(authenticated_user)):
    """Disconnect the signed-in user's Gmail and revoke the Google grant."""
    tokens = stored_tokens(principal.id)
    if tokens:
        revoke_token(tokens.get("refresh_token") or tokens["access_token"])
    return {"status": "disconnected" if delete_connection(principal.id) else "not_connected"}
