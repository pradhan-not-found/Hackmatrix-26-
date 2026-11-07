import copy
import json
import os
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.explanation import explain_locally
from backend.main import app, database
from tests.support_store import isolated_storage


REPORT = {"id": "00000000-0000-0000-0000-000000000001", "normalized_url": "https://example.com/",
          "risk_classification": "Low Risk", "findings": [], "recommendations": [],
          "checks": [{"name": "tls", "status": "completed"},
                     {"name": "threat_intelligence", "status": "completed", "matches": []}],
          "evidence_coverage": {"network_complete": True, "reputation_available": True}}


class LocalExplanationTests(unittest.TestCase):
    def test_clean_report_does_not_guarantee_safety(self):
        result = explain_locally(REPORT)
        self.assertIn("not a guarantee", result["summary"]["text"])
        text = " ".join(item["text"] for item in result["explanations"])
        self.assertIn("Encryption does not establish", text)
        self.assertIn("not proof of safety", text)

    def test_missing_reputation_is_inconclusive_and_actionable(self):
        report = {**REPORT, "risk_classification": "Inconclusive", "checks": [
            {"name": "threat_intelligence", "status": "unavailable", "reason": "Key not configured"}]}
        result = explain_locally(report)
        self.assertIn("not enough verified information", result["summary"]["text"])
        self.assertIn("Key not configured", result["explanations"][0]["text"])
        self.assertIn("investigate again", result["next_steps"][0]["text"])

    def test_configuration_findings_and_blocked_checks_are_not_called_phishing(self):
        report = {**REPORT, "findings": [{"id": "finding-1", "category": "configuration", "severity": "info",
            "description": "Security headers missing", "evidence": ["content-security-policy"]}],
            "checks": [{"name": "destination_safety", "status": "blocked"}]}
        result = explain_locally(report)
        self.assertIn("not proof of phishing", result["explanations"][0]["text"])
        self.assertIn("does not prove", result["explanations"][1]["text"])

    def test_malicious_match_explanation_and_citations(self):
        report = {**REPORT, "risk_classification": "Confirmed Malicious", "findings": [
            {"id": "finding-1", "category": "threat_intelligence", "severity": "critical",
             "description": "Known threat match", "evidence": [{"threatType": "MALWARE"}]}],
             "checks": [{"name": "threat_intelligence", "status": "completed", "matches": [{"threatType": "MALWARE"}]}]}
        before = copy.deepcopy(report)
        result = explain_locally(report)
        self.assertIn("Avoid interacting", result["summary"]["text"])
        self.assertNotIn("No matching listing", result["explanations"][-1]["text"])
        allowed = {item["id"] for item in result["evidence"]}
        for item in [result["summary"], *result["explanations"], *result["next_steps"]]:
            self.assertTrue(set(item["evidence_ids"]) <= allowed)
        self.assertEqual(report, before)

    @isolated_storage()
    def test_default_endpoint_is_local_even_with_a_gemini_key(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.dict(os.environ, {"INVESTIGATION_DB": f"{directory}/reports.sqlite3", "GEMINI_API_KEY": "unused"}):
                connection = database()
                with connection:
                    connection.execute("INSERT INTO investigations VALUES (?, ?)", (REPORT["id"], json.dumps(REPORT)))
                connection.close()
                with patch("backend.main.explain") as gemini, TestClient(app) as client:
                    response = client.post(f"/api/investigations/{REPORT['id']}/explanation")
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.json()["provider"], "Local rules")
                    gemini.assert_not_called()
                    saved = client.get(f"/api/investigations/{REPORT['id']}").json()
                    self.assertEqual(saved["risk_classification"], "Low Risk")
                    self.assertEqual(saved["ai_explanation"], response.json())
                    self.assertEqual(client.post(f"/api/investigations/{REPORT['id']}/explanation?provider=unknown").status_code, 422)
