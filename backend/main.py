import json
import os
import sqlite3
import threading
from pathlib import Path
from uuid import UUID
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend.investigation import investigate
from backend.network import UnsafeURL
from backend.gemini import explain
from backend.explanation import explain_locally

app = FastAPI(title="HackMatrix URL Investigation", version="0.1.0")
static_directory = Path(__file__).parent / "static"
app.mount("/assets", StaticFiles(directory=static_directory), name="assets")
# Bound simultaneous outbound scans in this single-process MVP.
slots = threading.BoundedSemaphore(4)


@app.get("/", include_in_schema=False)
def dashboard():
    return FileResponse(static_directory / "index.html")


def database():
    path = Path(os.getenv("INVESTIGATION_DB", "data/investigations.sqlite3"))
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=5)
    connection.execute("CREATE TABLE IF NOT EXISTS investigations (id TEXT PRIMARY KEY, report TEXT NOT NULL)")
    return connection


class InvestigationRequest(BaseModel):
    url: str = Field(min_length=1, max_length=4096)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/investigations", status_code=201)
def create_investigation(body: InvestigationRequest):
    if not slots.acquire(blocking=False):
        raise HTTPException(429, "Investigation capacity reached; retry later")
    try:
        try:
            report = investigate(body.url)
        except UnsafeURL as exc:
            raise HTTPException(422, str(exc)) from exc
        connection = database()
        try:
            with connection:
                connection.execute("INSERT INTO investigations VALUES (?, ?)",
                                   (report["id"], json.dumps(report)))
        finally:
            connection.close()
        return report
    finally:
        slots.release()


@app.get("/api/investigations")
def list_investigations(limit: int = Query(default=30, ge=1, le=100),
                        offset: int = Query(default=0, ge=0)):
    connection = database()
    try:
        rows = connection.execute(
            "SELECT report FROM investigations ORDER BY rowid DESC LIMIT ? OFFSET ?",
            (limit, offset),
        ).fetchall()
        total = connection.execute("SELECT COUNT(*) FROM investigations").fetchone()[0]
    finally:
        connection.close()
    fields = ("id", "submitted_url", "normalized_url", "risk_classification", "created_at", "status")
    items = [{key: report.get(key) for key in fields}
             for report in (json.loads(row[0]) for row in rows)]
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@app.get("/api/investigations/{investigation_id}")
def get_investigation(investigation_id: UUID):
    connection = database()
    try:
        row = connection.execute("SELECT report FROM investigations WHERE id = ?",
                                 (str(investigation_id),)).fetchone()
    finally:
        connection.close()
    if row is None:
        raise HTTPException(404, "Investigation not found")
    return json.loads(row[0])


@app.post("/api/investigations/{investigation_id}/explanation")
def explain_investigation(investigation_id: UUID, provider: Literal["local", "gemini"] = "local"):
    if not slots.acquire(blocking=False):
        raise HTTPException(429, "Investigation capacity reached; retry later")
    try:
        report = get_investigation(investigation_id)
        report["ai_explanation"] = explain(report) if provider == "gemini" else explain_locally(report)
        connection = database()
        try:
            with connection:
                connection.execute("UPDATE investigations SET report = ? WHERE id = ?",
                                   (json.dumps(report), str(investigation_id)))
        finally:
            connection.close()
        return report["ai_explanation"]
    finally:
        slots.release()
