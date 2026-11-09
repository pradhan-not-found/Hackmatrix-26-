"""Gmail connections must be owner-bound, encrypted at rest and passive when screening."""

import base64
import os
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend import gmail_api, gmail_connections
from backend.email_analysis import analyze_email
from backend.main import app
from backend.supabase import Principal, authenticated_user

OWNER = "00000000-0000-0000-0000-000000000001"
OTHER = "00000000-0000-0000-0000-000000000002"
TOKENS = {"access_token": "live-access-secret", "refresh_token": "live-refresh-secret", "expires_in": 3600,
          "user_info": {"email": "owner@example.com"}}
PHISH = ("Your bank account will be suspended. Verify your password and OTP immediately at "
         "https://paypal.com.account-verify.example/login or you will lose access. Urgent action required.")


def gmail_message(message_id, body, sender="PayPal Security <alerts@paypal-verify.example>", subject="Urgent: verify your account"):
    data = base64.urlsafe_b64encode(body.encode()).decode().rstrip("=")
    return {"id": message_id, "threadId": message_id, "labelIds": ["INBOX"], "payload": {
        "mimeType": "text/plain", "body": {"data": data},
        "headers": [{"name": "From", "value": sender},
                    {"name": "To", "value": "owner@example.com"}, {"name": "Subject", "value": subject},
                    {"name": "Date", "value": "Mon, 9 Nov 2026 10:00:00 +0000"}]}}


class GmailConnectionTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.database = Path(directory.name) / "email.sqlite3"
        environment = patch.dict(os.environ, {
            "EMAIL_ANALYSIS_DB": str(self.database), "GMAIL_CLIENT_ID": "client-id", "GMAIL_CLIENT_SECRET": "client-secret",
            "GMAIL_REDIRECT_URI": "http://localhost:3000/api/email/gmail/callback"})
        environment.start(); self.addCleanup(environment.stop)
        original = app.dependency_overrides.copy()
        self.addCleanup(lambda: (app.dependency_overrides.clear(), app.dependency_overrides.update(original)))
        self.user = [OWNER]
        app.dependency_overrides[authenticated_user] = lambda: Principal(self.user[0], "test-token")
        gmail_connections._scan_cache.clear()
        self.client = TestClient(app)

    def connect(self, user=OWNER):
        self.user[0] = user
        state = gmail_api.generate_auth_url(user)[1]
        with patch("backend.main.exchange_code_for_tokens", side_effect=lambda code, st: (gmail_api.validate_state(st), dict(TOKENS))):
            return self.client.get("/api/email/gmail/callback", params={"code": "c", "state": state})

    def test_every_gmail_route_requires_sign_in(self):
        del app.dependency_overrides[authenticated_user]
        routes = [("GET", "auth"), ("GET", "status"), ("POST", "scan"), ("POST", "disconnect"), ("GET", "messages"),
                  ("GET", "message/abc"), ("POST", "analyze")]
        for method, path in routes:
            self.assertEqual(self.client.request(method, f"/api/email/gmail/{path}", json={"message_ids": []}).status_code, 401, path)

    def test_email_query_parameter_cannot_select_another_inbox(self):
        self.connect(OWNER)
        self.user[0] = OTHER
        response = self.client.get("/api/email/gmail/status", params={"user_email": "owner@example.com"})
        self.assertEqual(response.json(), {"connected": False})
        self.assertEqual(self.client.get("/api/email/gmail/messages", params={"user_email": "owner@example.com"}).status_code, 409)

    def test_connection_belongs_to_the_user_who_started_it(self):
        self.assertEqual(self.connect(OWNER).status_code, 200)
        self.user[0] = OWNER
        status = self.client.get("/api/email/gmail/status").json()
        self.assertEqual((status["connected"], status["email"]), (True, "owner@example.com"))

    def test_tokens_are_encrypted_at_rest(self):
        self.connect(OWNER)
        raw = self.database.read_bytes()
        self.assertNotIn(b"live-refresh-secret", raw)
        self.assertNotIn(b"live-access-secret", raw)
        connection = sqlite3.connect(self.database)
        try:
            self.assertEqual(connection.execute("SELECT COUNT(*) FROM gmail_connections").fetchone()[0], 1)
        finally:
            connection.close()

    def test_state_is_single_use_and_rejects_forgery(self):
        state = gmail_api.generate_auth_url(OWNER)[1]
        self.assertEqual(gmail_api.validate_state(state), OWNER)
        self.assertIsNone(gmail_api.validate_state(state))
        self.assertIsNone(gmail_api.validate_state("forged"))
        response = self.client.get("/api/email/gmail/callback", params={"code": "c", "state": "forged"})
        self.assertIn("could not be connected", response.text)
        self.assertFalse(gmail_connections.connection_status(OWNER)["connected"])

    def test_denied_consent_stores_nothing(self):
        response = self.client.get("/api/email/gmail/callback", params={"error": "access_denied"})
        self.assertIn("could not be connected", response.text)

    def test_scan_flags_fraud_without_opening_links_or_exposing_clean_mail(self):
        self.connect(OWNER)
        self.user[0] = OWNER
        messages = {"bad": gmail_message("bad", PHISH), "ok": gmail_message(
            "ok", "See you at lunch tomorrow.", "Morgan <morgan@company.example>", "Lunch tomorrow")}
        with patch("backend.gmail_connections.list_messages", return_value={"messages": [{"id": "bad"}, {"id": "ok"}]}), \
                patch("backend.gmail_connections.get_message", side_effect=lambda token, message_id, format="full": messages[message_id]), \
                patch("backend.email_analysis.investigate", side_effect=AssertionError("links must not be opened")) as opened:
            result = self.client.post("/api/email/gmail/scan").json()
        opened.assert_not_called()
        self.assertEqual(result["scanned"], 2)
        self.assertEqual([item["id"] for item in result["flagged"]], ["bad"])
        self.assertNotIn("body", result["flagged"][0])

    def test_flagged_emails_join_email_analysis_history_once(self):
        self.connect(OWNER)
        self.user[0] = OWNER
        messages = {"bad": gmail_message("bad", PHISH), "ok": gmail_message(
            "ok", "See you at lunch tomorrow.", "Morgan <morgan@company.example>", "Lunch tomorrow")}
        for _ in range(2):
            gmail_connections._scan_cache.clear()
            with patch("backend.gmail_connections.list_messages", return_value={"messages": [{"id": "bad"}, {"id": "ok"}]}), \
                    patch("backend.gmail_connections.get_message", side_effect=lambda token, message_id, format="full": messages[message_id]):
                result = self.client.post("/api/email/gmail/scan").json()
        history = self.client.get("/api/email/results").json()
        self.assertEqual(history["total"], 1)
        self.assertEqual(history["items"][0]["id"], result["flagged"][0]["report_id"])
        self.assertEqual(self.client.get(f"/api/email/results/{history['items'][0]['id']}").status_code, 200)
        self.user[0] = OTHER
        self.assertEqual(self.client.get("/api/email/results").json()["total"], 0)

    def test_expired_google_access_asks_user_to_reconnect(self):
        self.connect(OWNER)
        self.user[0] = OWNER
        with patch("backend.gmail_connections.list_messages", side_effect=ValueError("Access token expired or invalid")):
            response = self.client.post("/api/email/gmail/scan")
        self.assertEqual(response.status_code, 409)
        self.assertIn("Reconnect", response.json()["detail"])

    def test_disconnect_revokes_and_deletes(self):
        self.connect(OWNER)
        self.user[0] = OWNER
        with patch("backend.main.revoke_token") as revoke:
            self.assertEqual(self.client.post("/api/email/gmail/disconnect").json(), {"status": "disconnected"})
        revoke.assert_called_once_with("live-refresh-secret")
        self.assertFalse(self.client.get("/api/email/gmail/status").json()["connected"])

    def test_offline_url_analysis_flags_deceptive_links(self):
        email = f"From: a@b.example\nSubject: Hi\n\nLogin at https://paypal.com.account-verify.example/login"
        with patch("backend.email_analysis.investigate", side_effect=AssertionError("links must not be opened")):
            report = analyze_email(email, "text", follow_links=False)
        self.assertEqual(report["urls"][0]["risk_classification"], "Suspicious")


if __name__ == "__main__":
    unittest.main()
