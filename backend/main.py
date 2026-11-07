import os
import sqlite3
import threading
from pathlib import Path
from uuid import UUID
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

from backend.investigation import investigate
from backend.network import UnsafeURL
from backend.gemini import explain, explain_message_analysis
from backend.explanation import explain_locally
from backend.message_analysis import MAX_MESSAGE_LENGTH, analyze_message
from backend.supabase import investigation_store

app = FastAPI(title="HackMatrix URL Investigation", version="0.1.0")
# Bound simultaneous outbound scans in this single-process MVP.
slots = threading.BoundedSemaphore(4)


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
    if not slots.acquire(blocking=False):
        raise HTTPException(429, "Investigation capacity reached; retry later")
    try:
        report = store.get(str(investigation_id))
        report["ai_explanation"] = explain(report) if provider == "gemini" else explain_locally(report)
        store.update(str(investigation_id), report)
        return report["ai_explanation"]
    finally:
        slots.release()
