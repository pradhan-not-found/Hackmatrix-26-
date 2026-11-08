import json
import os
import sqlite3
import threading
from urllib.parse import urlencode
from pathlib import Path
from uuid import UUID
from typing import Literal, Optional

from fastapi import Depends, FastAPI, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field, model_validator

from backend.investigation import investigate
from backend.network import UnsafeURL
from backend.gemini import explain, explain_message_analysis, saved_insights_match
from backend.explanation import explain_locally
from backend.message_analysis import MAX_MESSAGE_LENGTH, analyze_message
from backend.supabase import investigation_store
from backend.email_analysis import analyze_email, MAX_EMAIL_SIZE
from backend.gmail_api import (
    generate_auth_url, exchange_code_for_tokens, get_valid_access_token,
    list_messages, get_message, parse_gmail_message,
    revoke_user_tokens, get_stored_user_info
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
    return connection


# Email Analysis Endpoints

@app.post("/api/email/analyze", response_model=EmailAnalysisResponse,
          summary="Analyze pasted email text or raw headers",
          description="Provide exactly one of email_content (complete raw message) or raw_headers (header block only). Authentication evidence is reported separately from missing evidence.")
def analyze_email_text(body: EmailAnalysisRequest):
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
                    "INSERT INTO email_analyses VALUES (?, ?, ?)",
                    (report["id"], json.dumps(report), report["analyzed_at"])
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
    use_gemini: bool = Form(False)
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
            report = analyze_email(content, "eml", use_gemini)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc

        # Store in database
        connection = email_database()
        try:
            with connection:
                connection.execute(
                    "INSERT INTO email_analyses VALUES (?, ?, ?)",
                    (report["id"], json.dumps(report), report["analyzed_at"])
                )
        finally:
            connection.close()

        return report
    finally:
        slots.release()


@app.get("/api/email/results/{analysis_id}")
def get_email_analysis(analysis_id: UUID):
    """Retrieve a stored email analysis report."""
    connection = email_database()
    try:
        row = connection.execute(
            "SELECT report FROM email_analyses WHERE id = ?",
            (str(analysis_id),)
        ).fetchone()
    finally:
        connection.close()

    if row is None:
        raise HTTPException(404, "Email analysis not found")
    return json.loads(row[0])


@app.get("/api/email/results")
def list_email_analyses(
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0)
):
    """List stored email analyses."""
    connection = email_database()
    try:
        rows = connection.execute(
            "SELECT report FROM email_analyses ORDER BY rowid DESC LIMIT ? OFFSET ?",
            (limit, offset)
        ).fetchall()
        total = connection.execute("SELECT COUNT(*) FROM email_analyses").fetchone()[0]
    finally:
        connection.close()

    fields = ("id", "classification", "risk_score", "sender", "subject", "analyzed_at")
    items = [{key: report.get(key) for key in fields}
             for report in (json.loads(row[0]) for row in rows)]
    return {"items": items, "total": total, "limit": limit, "offset": offset}


# Gmail OAuth Endpoints

@app.get("/api/email/gmail/auth")
def gmail_auth():
    """Initiate Gmail OAuth flow."""
    try:
        auth_url, state = generate_auth_url()
        return {"auth_url": auth_url, "state": state}
    except ValueError as exc:
        raise HTTPException(503, str(exc)) from exc


@app.get("/api/email/gmail/callback")
def gmail_callback(code: str, state: str):
    """Handle Gmail OAuth callback."""
    try:
        tokens = exchange_code_for_tokens(code, state)
        frontend = os.environ.get("WEBASSURE_FRONTEND_URL", "http://localhost:3000").rstrip("/")
        query = urlencode({"gmail_oauth": "success", "email": tokens["user_info"].get("email", "")})
        return RedirectResponse(f"{frontend}/dashboard/email-analysis?{query}")
    except ValueError:
        frontend = os.environ.get("WEBASSURE_FRONTEND_URL", "http://localhost:3000").rstrip("/")
        return RedirectResponse(f"{frontend}/dashboard/email-analysis?gmail_oauth=error")


@app.get("/api/email/gmail/messages")
def gmail_list_messages(
    user_email: str,
    query: str = "",
    max_results: int = Query(default=50, ge=1, le=100),
    page_token: Optional[str] = None
):
    """List Gmail messages for authenticated user."""
    access_token = get_valid_access_token(user_email)
    if not access_token:
        raise HTTPException(401, "No valid Gmail session. Re-authenticate.")

    try:
        result = list_messages(access_token, query, max_results, page_token)
        return result
    except ValueError as exc:
        if "expired" in str(exc).lower() or "invalid" in str(exc).lower():
            raise HTTPException(401, "Gmail session expired. Re-authenticate.") from exc
        raise HTTPException(502, str(exc)) from exc


@app.get("/api/email/gmail/message/{message_id}")
def gmail_get_message(user_email: str, message_id: str):
    """Get a specific Gmail message."""
    access_token = get_valid_access_token(user_email)
    if not access_token:
        raise HTTPException(401, "No valid Gmail session. Re-authenticate.")

    try:
        message = get_message(access_token, message_id, format="full")
        parsed = parse_gmail_message(message)
        return parsed
    except ValueError as exc:
        if "expired" in str(exc).lower() or "invalid" in str(exc).lower():
            raise HTTPException(401, "Gmail session expired. Re-authenticate.") from exc
        raise HTTPException(502, str(exc)) from exc


@app.post("/api/email/gmail/analyze")
def gmail_analyze_messages(user_email: str, body: GmailAnalyzeRequest):
    """Analyze selected Gmail messages."""
    if not slots.acquire(blocking=False):
        raise HTTPException(429, "Analysis capacity reached; retry later")

    try:
        access_token = get_valid_access_token(user_email)
        if not access_token:
            raise HTTPException(401, "No valid Gmail session. Re-authenticate.")
        results = []
        for msg_id in body.message_ids[:10]:  # Limit to 10 messages per request
            try:
                message = get_message(access_token, msg_id, format="full")
                parsed = parse_gmail_message(message)

                # Combine text and HTML body for analysis
                email_content = f"From: {parsed['headers']['from']}\n"
                email_content += f"To: {parsed['headers']['to']}\n"
                email_content += f"Subject: {parsed['headers']['subject']}\n"
                email_content += f"Date: {parsed['headers']['date']}\n"
                email_content += f"Message-ID: {parsed['headers']['message_id']}\n"
                email_content += f"Return-Path: {parsed['headers']['return_path']}\n"
                email_content += f"Reply-To: {parsed['headers']['reply_to']}\n"
                email_content += f"Received: {parsed['headers']['received']}\n\n"
                email_content += parsed['body_text']
                if parsed['body_html']:
                    email_content += "\n\n--- HTML ---\n\n" + parsed['body_html']

                report = analyze_email(email_content, "text", body.use_gemini)
                report["gmail_message_id"] = msg_id
                results.append(report)
            except Exception as e:
                results.append({"gmail_message_id": msg_id, "error": str(e)})

        return {"results": results, "analyzed": len(results)}
    except ValueError as exc:
        if "expired" in str(exc).lower() or "invalid" in str(exc).lower():
            raise HTTPException(401, "Gmail session expired. Re-authenticate.") from exc
        raise HTTPException(502, str(exc)) from exc
    finally:
        slots.release()


@app.post("/api/email/gmail/disconnect")
def gmail_disconnect(user_email: str):
    """Disconnect Gmail account (revoke stored tokens)."""
    revoked = revoke_user_tokens(user_email)
    return {"status": "disconnected" if revoked else "not_connected"}


@app.get("/api/email/gmail/user")
def gmail_get_user(user_email: str):
    """Get stored Gmail user info."""
    user_info = get_stored_user_info(user_email)
    if not user_info:
        raise HTTPException(404, "No Gmail session found")
    return user_info
