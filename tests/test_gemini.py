import json
import os
import tempfile
import unittest
from urllib.error import HTTPError
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.gemini import evidence_snapshot, explain
from backend.main import app


REPORT = {"id": "00000000-0000-0000-0000-000000000001", "risk_classification": "Inconclusive",
          "normalized_url": "https://example.com/private?token=secret-query",
          "findings": [], "checks": [{"name": "threat_intelligence", "status": "unavailable"}],
          "evidence_coverage": {"reputation_available": False}, "limitations": ["Incomplete checks."]}
CONTENT = {"summary": {"text": "Reputation verification is incomplete.", "evidence_ids": ["assessment", "check-1"]},
           "explanations": [{"text": "The reputation check was unavailable.", "evidence_ids": ["check-1"]}],
           "next_steps": [{"text": "Configure the reputation provider and investigate again.", "evidence_ids": ["check-1"]}]}


class GeminiTests(unittest.TestCase):
    def setUp(self):
        patch.dict(os.environ, {"GEMINI_API_KEY": "test-secret-key", "GEMINI_MODEL": "gemini-2.5-flash"}).start()
        self.opener = patch("backend.gemini.build_opener").start()
        self.response = self.opener.return_value.open.return_value.__enter__.return_value
        self.set_content(CONTENT)
        self.addCleanup(patch.stopall)

    def set_content(self, content, finish="STOP"):
        self.response.read.return_value = json.dumps({"candidates": [{"finishReason": finish,
            "content": {"parts": [{"text": json.dumps(content)}]}}]}).encode()

    def test_explanation_is_cited_and_request_omits_sensitive_url_content(self):
        original = json.dumps(REPORT)
        result = explain(REPORT)
        self.assertEqual(result["status"], "completed")
        self.assertEqual(result["summary"], CONTENT["summary"])
        request = self.opener.return_value.open.call_args.args[0]
        self.assertNotIn("secret-query", request.data.decode())
        self.assertNotIn("/private", request.data.decode())
        self.assertNotIn("test-secret-key", request.data.decode())
        self.assertIn("systemInstruction", json.loads(request.data))
        self.assertEqual(json.dumps(REPORT), original)

    def test_snapshot_excludes_raw_headers_and_finding_url_evidence(self):
        report = {**REPORT, "findings": [{"id": "finding-1", "category": "transport", "severity": "medium",
                  "description": "Unencrypted HTTP", "evidence": "http://example.com/?secret=value"}],
                  "checks": [{"name": "http", "status": "completed", "headers": {"set-cookie": "private"}}]}
        snapshot = json.dumps(evidence_snapshot(report))
        self.assertNotIn("secret", snapshot)
        self.assertNotIn("set-cookie", snapshot)

    def test_unknown_citations_extra_fields_and_truncated_outputs_are_rejected(self):
        for content in ({**CONTENT, "summary": {"text": "Invented", "evidence_ids": ["fake"]}},
                        {**CONTENT, "risk_classification": "Low Risk"},
                        {**CONTENT, "summary": {"text": "Uncited", "evidence_ids": []}}):
            self.set_content(content)
            self.assertEqual(explain(REPORT)["error_code"], "invalid_response")
        self.set_content(CONTENT, finish="MAX_TOKENS")
        self.assertEqual(explain(REPORT)["status"], "unavailable")

    def test_missing_key_and_invalid_model_do_not_call_provider(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}):
            self.assertEqual(explain(REPORT)["error_code"], "not_configured")
        with patch.dict(os.environ, {"GEMINI_MODEL": "../../other"}):
            self.assertEqual(explain(REPORT)["error_code"], "configuration_error")
        self.opener.assert_not_called()

    def test_errors_are_secret_free_and_leave_report_usable(self):
        for status, code in ((403, "configuration_error"), (429, "quota_exceeded"), (500, "provider_error")):
            self.opener.return_value.open.side_effect = HTTPError("https://provider.test", status, "test-secret-key", {}, None)
            result = explain(REPORT)
            self.assertEqual(result["error_code"], code)
            self.assertNotIn("test-secret-key", json.dumps(result))
        self.opener.return_value.open.side_effect = TimeoutError()
        self.assertEqual(explain(REPORT)["error_code"], "network_error")

    def test_endpoint_persists_explanation_without_changing_assessment(self):
        from backend.main import database
        with tempfile.TemporaryDirectory() as directory:
            with patch.dict(os.environ, {"INVESTIGATION_DB": f"{directory}/test.sqlite3"}):
                connection = database()
                with connection:
                    connection.execute("INSERT INTO investigations VALUES (?, ?)", (REPORT["id"], json.dumps(REPORT)))
                connection.close()
                with TestClient(app) as client:
                    result = client.post(f"/api/investigations/{REPORT['id']}/explanation")
                    self.assertEqual(result.status_code, 200)
                    self.assertEqual(result.json()["status"], "completed")
                    saved = client.get(f"/api/investigations/{REPORT['id']}").json()
                    self.assertEqual(saved["risk_classification"], REPORT["risk_classification"])
                    self.assertEqual(saved["ai_explanation"], result.json())
                    self.assertEqual(client.post('/api/investigations/00000000-0000-0000-0000-000000000000/explanation').status_code, 404)
