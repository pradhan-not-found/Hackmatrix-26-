import os
import socket
import ssl
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.investigation import investigate, reputation
from backend.main import app
from backend.network import UnsafeURL, fetch, normalize_url, public_addresses


def result(url="https://example.com/", status=200, headers=None):
    return {"url": url, "status": status, "address": "93.184.216.34",
            "headers": headers or {}, "tls": {"verified": True}}


class NetworkTests(unittest.TestCase):
    def test_dashboard_and_assets_are_served(self):
        with TestClient(app) as client:
            page = client.get("/")
            self.assertEqual(page.status_code, 200)
            self.assertIn("text/html", page.headers["content-type"])
            self.assertIn('id="investigation-form"', page.text)
            self.assertIn('role="tablist"', page.text)
            for asset in ("dashboard.css", "dashboard.js"):
                self.assertEqual(client.get(f"/assets/{asset}").status_code, 200)
            self.assertEqual(client.get("/assets/missing.js").status_code, 404)

    def test_normalization(self):
        self.assertEqual(normalize_url("EXAMPLE.com/a b".replace(" ", "%20")), "https://example.com/a%20b")
        self.assertEqual(normalize_url("https://example.com:443#fragment"), "https://example.com/")
        self.assertIn("xn--", normalize_url("https://bücher.de"))

    def test_invalid_input(self):
        for url in ("file:///etc/passwd", "https://u:p@example.com", "https://example.com:22",
                    "https://example.com\\@localhost", "https://exa mple.com", "https://-invalid.com"):
            with self.subTest(url=url), self.assertRaises(UnsafeURL):
                normalize_url(url)

    def test_non_public_and_mixed_dns_blocked(self):
        for address in ("127.0.0.1", "10.0.0.1", "169.254.169.254", "::1", "fc00::1",
                        "::ffff:8.8.8.8", "224.0.0.1", "192.0.2.1", "64:ff9b::a00:1"):
            answers = [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, 443))
                       for ip in ("8.8.8.8", address)]
            with self.subTest(address=address), patch("socket.getaddrinfo", return_value=answers):
                with self.assertRaises(UnsafeURL):
                    public_addresses("example.com", 443)

    @patch("backend.network.ssl.create_default_context")
    @patch("backend.network.http.client.HTTPConnection")
    @patch("backend.network.socket.create_connection")
    def test_connects_to_pinned_ip_with_original_sni(self, connect, connection, context):
        response = connection.return_value.getresponse.return_value
        response.status = 200
        response.getheaders.return_value = []
        tls = context.return_value.wrap_socket.return_value
        tls.getpeercert.return_value = {}
        tls.cipher.return_value = ("TLS_AES_256_GCM_SHA384", "TLSv1.3", 256)
        fetch("https://example.com/", ["8.8.8.8"])
        connect.assert_called_once_with(("8.8.8.8", 443), timeout=5)
        context.return_value.wrap_socket.assert_called_once_with(connect.return_value, server_hostname="example.com")
        self.assertEqual(connection.return_value.request.call_args.args[0], "HEAD")
        connection.return_value.close.assert_called_once()

    def test_reputation_disabled_without_key(self):
        with patch.dict(os.environ, {"GOOGLE_SAFE_BROWSING_API_KEY": ""}):
            self.assertEqual(reputation(["https://example.com/"])["status"], "unavailable")

    def test_reputation_provider_payload_and_errors(self):
        import json
        with patch.dict(os.environ, {"GOOGLE_SAFE_BROWSING_API_KEY": "test"}):
            with patch("backend.threat_intelligence.build_opener") as opener:
                response = opener.return_value.open.return_value.__enter__.return_value
                response.read.return_value = b'{}'
                self.assertEqual(reputation(["https://example.com/"])["matches"], [])
                request = opener.return_value.open.call_args.args[0]
                self.assertEqual(json.loads(request.data)["threatInfo"]["threatEntries"],
                                 [{"url": "https://example.com/"}])
                for payload in (b'[]', b'not json', b'{"matches": null}',
                                b'{"matches": [{"threat": {"url": "https://other.com"}}]}'):
                    response.read.return_value = payload
                    self.assertEqual(reputation(["https://example.com/"])["status"], "unavailable")
                opener.return_value.open.side_effect = TimeoutError()
                self.assertEqual(reputation(["https://example.com/"])["status"], "unavailable")


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.dns = patch("backend.investigation.public_addresses", return_value=["8.8.8.8"]).start()
        self.fetch = patch("backend.investigation.fetch", return_value=result()).start()
        self.reputation = patch("backend.investigation.reputation", return_value={"status": "completed", "matches": []}).start()
        self.addCleanup(patch.stopall)

    def test_three_benign_cases(self):
        for host in ("example.com", "example.org", "example.net"):
            with self.subTest(host=host):
                self.fetch.return_value = result(f"https://{host}/")
                report = investigate(host)
                self.assertEqual(report["risk_classification"], "Low Risk")
                self.assertTrue(report["findings"])  # Missing headers alone do not imply phishing.

    def test_three_suspicious_cases(self):
        for url in ("https://xn--bcher-kva.de", "https://a-b-c-d-e.com", "http://example.com"):
            with self.subTest(url=url):
                report = investigate(url)
                self.assertEqual(report["risk_classification"], "Suspicious")

    def test_provider_unavailable_is_inconclusive(self):
        self.reputation.return_value = {"status": "unavailable", "reason": "not configured"}
        self.assertEqual(investigate("example.com")["risk_classification"], "Inconclusive")

    def test_authoritative_match(self):
        self.reputation.return_value = {"status": "completed", "source": "test provider",
                                        "matches": [{"threatType": "SOCIAL_ENGINEERING"}]}
        report = investigate("example.com")
        self.assertEqual(report["risk_classification"], "Confirmed Malicious")
        self.assertEqual(report["findings"][-1]["source"], "test provider")

    def test_redirect_to_private_destination_blocked(self):
        self.fetch.return_value = result(status=302, headers={"location": "http://127.0.0.1/"})
        self.dns.side_effect = [["8.8.8.8"], UnsafeURL("private address")]
        report = investigate("example.com")
        self.assertEqual(self.fetch.call_count, 1)
        self.assertEqual(report["risk_classification"], "Inconclusive")
        self.assertEqual(report["checks"][-2]["status"], "blocked")

    def test_redirect_limit(self):
        self.fetch.side_effect = [result(f"https://example.com/{i}", 302, {"location": f"/{i+1}"}) for i in range(6)]
        report = investigate("example.com")
        self.assertEqual(self.fetch.call_count, 6)
        self.assertIn("Redirect limit reached.", report["limitations"])

    def test_timeout_and_tls_failure(self):
        for error in (TimeoutError(), ssl.SSLCertVerificationError(1, "bad certificate")):
            with self.subTest(error=type(error).__name__):
                if isinstance(error, ssl.SSLCertVerificationError):
                    error.verify_message = "certificate expired"
                self.fetch.side_effect = error
                report = investigate("example.com")
                self.assertEqual(report["status"], "completed")
                self.assertNotEqual(report["risk_classification"], "Low Risk")

    def test_api_persists_and_retrieves(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.dict(os.environ, {"INVESTIGATION_DB": f"{directory}/reports.sqlite3"}):
                with TestClient(app) as client:
                    response = client.post("/api/investigations", json={"url": "example.com"})
                    self.assertEqual(response.status_code, 201)
                    report = response.json()
                    self.assertEqual(report["ai_explanation"]["provider"], "Local rules")
                    self.assertEqual(report["ai_explanation"]["status"], "completed")
                    self.assertEqual(client.get(f"/api/investigations/{report['id']}").json(), report)
                    self.assertEqual(client.post("/api/investigations", json={"url": "file:///etc/passwd"}).status_code, 422)
                    self.assertEqual(client.get("/api/investigations/00000000-0000-0000-0000-000000000000").status_code, 404)

    def test_history_is_recent_first_paginated_and_summary_only(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.dict(os.environ, {"INVESTIGATION_DB": f"{directory}/reports.sqlite3"}):
                with TestClient(app) as client:
                    self.assertEqual(client.get("/api/investigations").json()["items"], [])
                    first = client.post("/api/investigations", json={"url": "example.com"}).json()
                    second = client.post("/api/investigations", json={"url": "example.org"}).json()
                    page = client.get("/api/investigations?limit=1").json()
                    self.assertEqual(page["total"], 2)
                    self.assertEqual(page["items"][0]["id"], second["id"])
                    self.assertNotIn("findings", page["items"][0])
                    older = client.get("/api/investigations?limit=1&offset=1").json()
                    self.assertEqual(older["items"][0]["id"], first["id"])
                    for query in ("limit=0", "limit=101", "offset=-1"):
                        self.assertEqual(client.get(f"/api/investigations?{query}").status_code, 422)


if __name__ == "__main__":
    unittest.main()
