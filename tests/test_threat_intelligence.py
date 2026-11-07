import json
import os
import ssl
import tempfile
import unittest
from pathlib import Path
from urllib.error import HTTPError, URLError
from unittest.mock import MagicMock, patch

from backend.threat_intelligence import api_key, reputation
from backend.validate_threat_intelligence import validate
from backend.investigation import investigate

BENIGN_URL = "https://example.com/"
MALICIOUS_TEST_URL = "http://testsafebrowsing.appspot.com/apiv4/ANY_PLATFORM/MALWARE/URL/"
MATCH = {"threatType": "MALWARE", "platformType": "ANY_PLATFORM", "threatEntryType": "URL",
         "threat": {"url": MALICIOUS_TEST_URL}, "cacheDuration": "300s"}


class ThreatIntelligenceTests(unittest.TestCase):
    def setUp(self):
        patch.dict(os.environ, {"GOOGLE_SAFE_BROWSING_API_KEY": "test-secret"}).start()
        self.opener = patch("backend.threat_intelligence.build_opener").start()
        self.response = self.opener.return_value.open.return_value.__enter__.return_value
        self.response.read.return_value = b'{}'
        self.addCleanup(patch.stopall)

    def test_benign_no_match_and_documented_malicious_match(self):
        clean = reputation([BENIGN_URL])
        self.assertEqual(clean["status"], "completed")
        self.assertEqual(clean["matches"], [])
        self.response.read.return_value = json.dumps({"matches": [MATCH]}).encode()
        flagged = reputation([MALICIOUS_TEST_URL])
        self.assertEqual(flagged["status"], "completed")
        self.assertEqual(flagged["matches"], [MATCH])
        self.assertEqual(flagged["checked_urls"], [MALICIOUS_TEST_URL])
        self.assertIn("checked_at", flagged)

    def test_failures_have_actionable_codes_and_never_leak_credentials(self):
        for code, expected in ((400, "configuration_error"), (403, "configuration_error"),
                               (429, "quota_exceeded"), (503, "provider_http_error")):
            with self.subTest(http_status=code):
                self.opener.return_value.open.side_effect = HTTPError(
                    "https://provider.test/?key=test-secret", code, "test-secret", {}, None)
                result = reputation([BENIGN_URL])
                self.assertEqual(result["status"], "unavailable")
                self.assertEqual(result["error_code"], expected)
                self.assertEqual(result["http_status"], code)
                self.assertNotIn("matches", result)
                self.assertNotIn("test-secret", json.dumps(result))

    def test_network_tls_and_timeout_failures(self):
        for failure, code in ((TimeoutError(), "timeout"),
                              (URLError(TimeoutError()), "timeout"),
                              (URLError(ssl.SSLError("test-secret")), "tls_error"),
                              (URLError("test-secret"), "network_error")):
            with self.subTest(code=code):
                self.opener.return_value.open.side_effect = failure
                result = reputation([BENIGN_URL])
                self.assertEqual(result["error_code"], code)
                self.assertNotIn("test-secret", json.dumps(result))

    def test_malformed_unrelated_and_oversize_responses_are_not_clean(self):
        payloads = [b'[]', b'{"error": {}}', b'{"matches": null}', b'\xff', b'x' * 262145]
        for change in ({"threatType": "UNKNOWN"}, {"platformType": "WINDOWS"},
                       {"threatEntryType": "EXECUTABLE"}, {"threat": {"url": BENIGN_URL}}):
            payloads.append(json.dumps({"matches": [{**MATCH, **change}]}).encode())
        for payload in payloads:
            with self.subTest(length=len(payload)):
                self.response.read.return_value = payload
                self.assertEqual(reputation([MALICIOUS_TEST_URL])["error_code"], "invalid_response")

    def test_env_file_loading_and_environment_precedence(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / ".env"
            path.write_text('GOOGLE_SAFE_BROWSING_API_KEY="local-test-key"\n', encoding="utf-8")
            with patch("backend.threat_intelligence.ENV_FILE", path):
                with patch.dict(os.environ, {}, clear=True):
                    self.assertEqual(api_key(), "local-test-key")
                self.assertEqual(api_key(), "test-secret")
                with patch.dict(os.environ, {"GOOGLE_SAFE_BROWSING_API_KEY": ""}):
                    self.assertEqual(reputation([BENIGN_URL])["error_code"], "not_configured")

    def test_override_does_not_modify_environment(self):
        reputation([BENIGN_URL], key_override="invalid-validation-key")
        request = self.opener.return_value.open.call_args.args[0]
        self.assertIn("key=invalid-validation-key", request.full_url)
        self.assertEqual(api_key(), "test-secret")

    def test_input_limits_and_duplicate_urls(self):
        self.assertEqual(reputation([])["error_code"], "invalid_input")
        self.assertEqual(reputation([f"https://example.com/{i}" for i in range(501)])["error_code"], "invalid_input")
        reputation([BENIGN_URL, BENIGN_URL])
        request = self.opener.return_value.open.call_args.args[0]
        entries = json.loads(request.data)["threatInfo"]["threatEntries"]
        self.assertEqual(entries, [{"url": BENIGN_URL}])

    def test_provider_results_reach_pipeline_classification(self):
        response = {"url": BENIGN_URL, "address": "8.8.8.8", "status": 200,
                    "headers": {}, "tls": {"verified": True}}
        with patch("backend.investigation.public_addresses", return_value=["8.8.8.8"]):
            with patch("backend.investigation.fetch", return_value=response) as fetch:
                self.assertEqual(investigate(BENIGN_URL)["risk_classification"], "Low Risk")
                fetch.return_value = {**response, "url": MALICIOUS_TEST_URL}
                self.response.read.return_value = json.dumps({"matches": [MATCH]}).encode()
                flagged = investigate(MALICIOUS_TEST_URL)
                self.assertEqual(flagged["risk_classification"], "Confirmed Malicious")
                fetch.return_value = response
                self.opener.return_value.open.side_effect = HTTPError("https://provider.test", 403, "denied", {}, None)
                failed = investigate(BENIGN_URL)
                self.assertEqual(failed["risk_classification"], "Inconclusive")
                self.assertFalse(failed["evidence_coverage"]["reputation_available"])

    def test_redirected_url_is_checked_even_when_its_http_fetch_fails(self):
        response = {"url": BENIGN_URL, "address": "8.8.8.8", "status": 302,
                    "headers": {"location": "https://example.org/"}, "tls": {"verified": True}}
        with patch("backend.investigation.public_addresses", return_value=["8.8.8.8"]):
            with patch("backend.investigation.fetch", side_effect=[response, TimeoutError()]):
                report = investigate(BENIGN_URL)
                intelligence = report["checks"][-1]
                self.assertIn(BENIGN_URL, intelligence["checked_urls"])
                self.assertIn("https://example.org/", intelligence["checked_urls"])

    def test_validation_runner_reports_all_three_results(self):
        rejected = HTTPError("https://provider.test", 400, "invalid", {}, None)
        benign = self.opener.return_value.open.return_value
        flagged = MagicMock()
        flagged.__enter__.return_value.read.return_value = json.dumps({"matches": [MATCH]}).encode()
        self.opener.return_value.open.side_effect = [benign, flagged, rejected]
        evidence = validate()
        self.assertTrue(evidence["passed"])
        self.assertEqual([case["outcome"] for case in evidence["cases"]], ["passed"] * 3)

    def test_validation_runner_does_not_claim_unconfigured_or_failed_success(self):
        self.opener.return_value.open.side_effect = TimeoutError()
        with patch.dict(os.environ, {"GOOGLE_SAFE_BROWSING_API_KEY": ""}):
            evidence = validate()
        self.assertFalse(evidence["passed"])
        self.assertEqual([case["outcome"] for case in evidence["cases"]], ["skipped", "skipped", "failed"])
