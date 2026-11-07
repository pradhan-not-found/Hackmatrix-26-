"""Offline storage override for legacy pipeline tests; never enabled in the app."""
import json
from contextlib import contextmanager

from fastapi import HTTPException
from backend.main import app, database
from backend.supabase import investigation_store


class SQLiteFixtureStore:
    def create(self, report):
        connection = database()
        try:
            with connection:
                connection.execute('INSERT INTO investigations VALUES (?, ?)', (report['id'], json.dumps(report)))
        finally:
            connection.close()

    def get(self, investigation_id):
        connection = database()
        try:
            row = connection.execute('SELECT report FROM investigations WHERE id = ?', (investigation_id,)).fetchone()
        finally:
            connection.close()
        if not row:
            raise HTTPException(404, 'Investigation not found')
        return json.loads(row[0])

    def update(self, investigation_id, report):
        connection = database()
        try:
            with connection:
                connection.execute('UPDATE investigations SET report = ? WHERE id = ?', (json.dumps(report), investigation_id))
        finally:
            connection.close()

    def list(self, limit, offset):
        connection = database()
        try:
            rows = connection.execute('SELECT report FROM investigations ORDER BY rowid DESC LIMIT ? OFFSET ?', (limit, offset)).fetchall()
            total = connection.execute('SELECT COUNT(*) FROM investigations').fetchone()[0]
        finally:
            connection.close()
        fields = ('id', 'submitted_url', 'normalized_url', 'risk_classification', 'created_at', 'status')
        return {'items': [{key: report.get(key) for key in fields} for report in (json.loads(row[0]) for row in rows)], 'total': total, 'limit': limit, 'offset': offset}


@contextmanager
def isolated_storage():
    original = app.dependency_overrides.copy()
    app.dependency_overrides[investigation_store] = SQLiteFixtureStore
    try:
        yield
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(original)
