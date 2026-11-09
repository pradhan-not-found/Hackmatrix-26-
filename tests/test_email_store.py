import os
import unittest
from unittest.mock import patch

from backend import email_store, gmail_api, gmail_connections

OWNER = "11111111-1111-4111-8111-111111111111"
REPORT = {"id": "22222222-2222-4222-8222-222222222222", "analyzed_at": "2026-11-09T10:00:00+00:00", "subject": "Hello"}
ENV = {"EMAIL_STORE": "supabase", "GMAIL_CLIENT_ID": "id", "GMAIL_CLIENT_SECRET": "secret",
       "GMAIL_REDIRECT_URI": "https://example.test/api/email/gmail/callback"}


class SupabaseEmailStoreTests(unittest.TestCase):
    def setUp(self):
        environment = patch.dict(os.environ, ENV)
        environment.start(); self.addCleanup(environment.stop)
        client = patch("backend.email_store.request_supabase")
        self.request = client.start(); self.addCleanup(client.stop)
        self.request.return_value = ([], {"Content-Range": "0-0/0"})

    def test_vercel_selects_supabase_and_local_keeps_sqlite(self):
        with patch.dict(os.environ, {"EMAIL_STORE": "", "VERCEL": "1"}):
            self.assertTrue(email_store.using_supabase())
        with patch.dict(os.environ, {"EMAIL_STORE": ""}):
            os.environ.pop("VERCEL", None)
            self.assertFalse(email_store.using_supabase())

    def test_analysis_uses_the_callers_session_and_owner(self):
        email_store.save_analysis(OWNER, "user-jwt", REPORT)
        path, token, method, body, _ = self.request.call_args.args
        self.assertEqual((path, token, method), ("/rest/v1/email_analyses", "user-jwt", "POST"))
        self.assertEqual((body["id"], body["user_id"]), (REPORT["id"], OWNER))

    def test_duplicate_inbox_reports_are_ignored(self):
        email_store.save_analysis(OWNER, "user-jwt", REPORT, ignore_duplicate=True)
        self.assertIn("on_conflict=id", self.request.call_args.args[0])
        self.assertIn("ignore-duplicates", self.request.call_args.args[4]["Prefer"])

    def test_reads_are_filtered_to_the_owner(self):
        self.assertIsNone(email_store.get_analysis(OWNER, "user-jwt", REPORT["id"]))
        self.assertIn(f"user_id=eq.{OWNER}", self.request.call_args.args[0])
        self.assertEqual(email_store.list_analyses(OWNER, "user-jwt", 10, 0), {"items": [], "total": 0})
        self.assertIn(f"user_id=eq.{OWNER}", self.request.call_args.args[0])

    def test_missing_session_never_reaches_supabase(self):
        with self.assertRaises(Exception):
            email_store.get_analysis(OWNER, None, REPORT["id"])
        self.request.assert_not_called()

    def test_gmail_tokens_are_encrypted_before_storage(self):
        gmail_connections.save_connection(OWNER, {"access_token": "live-access", "refresh_token": "live-refresh", "user_info": {"email": "a@b.c"}}, "user-jwt")
        sent = self.request.call_args.args[3]
        self.assertEqual((sent["user_id"], sent["email"]), (OWNER, "a@b.c"))
        self.assertNotIn("live-access", sent["tokens"])
        self.assertNotIn("live-refresh", sent["tokens"])

    def test_oauth_state_works_on_any_instance_and_rejects_forgery(self):
        state = gmail_api.generate_auth_url(OWNER, "user-jwt")[1]
        self.assertNotIn("user-jwt", state)
        gmail_api._oauth_states.clear()
        self.assertEqual(gmail_api.read_state(state), (OWNER, "user-jwt"))
        self.assertEqual(gmail_api.validate_state(state), OWNER)
        self.assertIsNone(gmail_api.validate_state("forged"))
        with patch.dict(os.environ, {"GMAIL_CLIENT_SECRET": "different"}):
            self.assertIsNone(gmail_api.validate_state(state))


if __name__ == "__main__":
    unittest.main()
