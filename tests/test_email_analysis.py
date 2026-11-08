"""Tests for email analysis module."""

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock

from fastapi.testclient import TestClient

from backend.email_analysis import (
    analyze_email,
    parse_eml_file,
    parse_email_text,
    analyze_sender,
    analyze_authentication_headers,
    analyze_attachments,
    analyze_email_content,
    analyze_urls_in_email,
    calculate_risk_score,
    generate_recommendations,
    decode_mime_header,
    extract_email_addresses,
    parse_email_address,
    get_email_body,
    extract_urls_from_text,
    extract_urls_from_html,
    MAX_EMAIL_SIZE
)
from backend.main import app
from backend.supabase import authenticated_user, Principal


class EmailParsingTests(unittest.TestCase):
    def test_decode_mime_header(self):
        self.assertEqual(decode_mime_header("Hello World"), "Hello World")
        # Test encoded word
        encoded = "=?utf-8?q?Hello_World?="
        self.assertEqual(decode_mime_header(encoded), "Hello World")

    def test_extract_email_addresses(self):
        text = "From: John Doe <john@example.com>, Jane <jane@test.org>"
        emails = extract_email_addresses(text)
        self.assertIn("john@example.com", emails)
        self.assertIn("jane@test.org", emails)

    def test_parse_email_address(self):
        name, addr = parse_email_address('John Doe <john@example.com>')
        self.assertEqual(name, "John Doe")
        self.assertEqual(addr, "john@example.com")

        name, addr = parse_email_address('john@example.com')
        self.assertEqual(name, "")
        self.assertEqual(addr, "john@example.com")

    def test_get_email_body_text_only(self):
        msg = parse_email_text("Subject: Test\n\nHello World")
        text, html = get_email_body(msg)
        self.assertEqual(text, "Hello World")
        self.assertEqual(html, "")

    def test_get_email_body_html_only(self):
        msg = parse_email_text(
            "Subject: Test\n"
            "Content-Type: text/html; charset=utf-8\n"
            "MIME-Version: 1.0\n\n"
            "<html><body>Hello <b>World</b></body></html>"
        )
        text, html = get_email_body(msg)
        # HTML content gets converted to text too
        self.assertIn("Hello", text + html)
        self.assertIn("<b>World</b>", html)

    def test_extract_urls_from_text(self):
        text = "Check https://example.com and http://test.org/path?query=1"
        urls = extract_urls_from_text(text)
        self.assertIn("https://example.com", urls)
        self.assertIn("http://test.org/path?query=1", urls)

    def test_extract_urls_from_html(self):
        html = '<a href="https://example.com">Link</a> <img src="http://test.org/img.png">'
        urls = extract_urls_from_html(html)
        self.assertIn("https://example.com", urls)
        self.assertIn("http://test.org/img.png", urls)


class SenderAnalysisTests(unittest.TestCase):
    def test_sender_mismatch_detection(self):
        result = analyze_sender(
            "sender@domain.com",
            "From Name <from@different.com>",
            "reply@another.com"
        )
        self.assertTrue(result["mismatch"])
        self.assertIn("differs", " ".join(result["details"]))

    def test_suspicious_free_email_with_brand(self):
        result = analyze_sender(
            "security@paypal.com",
            "PayPal Security <paypal.security@gmail.com>",
            ""
        )
        self.assertTrue(result["suspicious"])
        self.assertTrue(any("free email" in d.lower() for d in result["details"]))

    def test_suspicious_tld(self):
        result = analyze_sender(
            "test@phishing.xyz",
            "Test <test@phishing.xyz>",
            ""
        )
        self.assertTrue(result["suspicious"])
        self.assertTrue(any(".xyz" in d for d in result["details"]))

    def test_subdomain_spoofing(self):
        result = analyze_sender(
            "security@paypal.phisher.com",
            "PayPal Security <security@paypal.phisher.com>",
            ""
        )
        self.assertTrue(result["suspicious"])
        self.assertTrue(any("impersonation" in d.lower() for d in result["details"]))


class AuthenticationTests(unittest.TestCase):
    def test_auth_results_parsing(self):
        from email.message import EmailMessage
        msg = EmailMessage()
        msg["Authentication-Results"] = "mx.example.com; spf=pass; dkim=fail; dmarc=none"
        msg["Received-SPF"] = "pass (example.com: domain of user@example.com designates 1.2.3.4 as permitted sender)"
        msg["DKIM-Signature"] = "v=1; a=rsa-sha256; d=example.com; s=selector"

        result = analyze_authentication_headers(msg)
        self.assertEqual(result["spf"], "PASS")
        self.assertEqual(result["dkim"], "FAIL")
        self.assertEqual(result["dmarc"], "NONE")
        self.assertTrue(any("DKIM-Signature" in d for d in result["details"]))

    def test_missing_auth_headers(self):
        from email.message import EmailMessage
        msg = EmailMessage()
        result = analyze_authentication_headers(msg)
        self.assertEqual(result["spf"], "NONE")
        self.assertEqual(result["dkim"], "NONE")
        self.assertEqual(result["dmarc"], "NONE")
        self.assertEqual(result["evidence_present"], {"spf": False, "dkim": False, "dmarc": False})

    def test_authentication_none_result_is_not_missing_evidence(self):
        from email.message import EmailMessage
        msg = EmailMessage()
        msg["Authentication-Results"] = "mx.example.com; spf=none; dkim=none; dmarc=none"
        result = analyze_authentication_headers(msg)
        self.assertEqual(result["spf"], "NONE")
        self.assertTrue(all(result["evidence_present"].values()))


class AttachmentTests(unittest.TestCase):
    def test_dangerous_extension_detection(self):
        from email.message import EmailMessage
        from email.mime.application import MIMEApplication
        msg = EmailMessage()
        msg.make_mixed()
        part = MIMEApplication(b"test", Name="malware.exe")
        part.add_header("Content-Disposition", 'attachment; filename="malware.exe"')
        msg.attach(part)

        attachments = analyze_attachments(msg)
        self.assertEqual(len(attachments), 1)
        self.assertEqual(attachments[0]["risk_level"], "HIGH")
        self.assertTrue(any("exe" in r for r in attachments[0]["risk_reasons"]))

    def test_suspicious_extension(self):
        from email.message import EmailMessage
        from email.mime.application import MIMEApplication
        msg = EmailMessage()
        msg.make_mixed()
        part = MIMEApplication(b"test", Name="document.pdf")
        part.add_header("Content-Disposition", 'attachment; filename="document.pdf"')
        msg.attach(part)

        attachments = analyze_attachments(msg)
        self.assertEqual(len(attachments), 1)
        self.assertEqual(attachments[0]["risk_level"], "MEDIUM")

    def test_double_extension(self):
        from email.message import EmailMessage
        from email.mime.application import MIMEApplication
        msg = EmailMessage()
        msg.make_mixed()
        part = MIMEApplication(b"test", Name="invoice.pdf.exe")
        part.add_header("Content-Disposition", 'attachment; filename="invoice.pdf.exe"')
        msg.attach(part)

        attachments = analyze_attachments(msg)
        self.assertEqual(attachments[0]["risk_level"], "HIGH")
        self.assertTrue(any("Double extension" in r for r in attachments[0]["risk_reasons"]))


class ContentAnalysisTests(unittest.TestCase):
    def test_indicator_detection(self):
        text = "Urgent! Your account suspended. Verify your OTP immediately."
        html = "<p>Urgent! Your account suspended. Verify your OTP immediately.</p>"
        result = analyze_email_content(text, html)

        codes = {i["code"] for i in result["indicators"]}
        self.assertIn("urgency_pressure", codes)
        self.assertIn("otp_theft", codes)
        self.assertIn("banking_kyc", codes)

    def test_no_false_positives_on_clean_text(self):
        text = "Hi John, thanks for the meeting yesterday. See you next week."
        html = "<p>Hi John, thanks for the meeting yesterday.</p>"
        result = analyze_email_content(text, html)
        self.assertEqual(result["indicator_count"], 0)


class URLAnalysisTests(unittest.TestCase):
    @patch("backend.email_analysis.investigate")
    def test_url_analysis_calls_investigate(self, mock_investigate):
        mock_investigate.return_value = {
            "risk_classification": "Suspicious",
            "findings": [{"category": "url", "severity": "medium", "description": "Test"}],
            "redirect_chain": [{"url": "https://example.com"}],
            "final_url": "https://example.com"
        }

        urls = ["https://example.com", "http://test.org"]
        results = analyze_urls_in_email(urls)

        self.assertEqual(len(results), 2)
        self.assertEqual(mock_investigate.call_count, 2)
        self.assertEqual(results[0]["risk_classification"], "Suspicious")


class RiskScoringTests(unittest.TestCase):
    def test_safe_classification(self):
        sender = {"mismatch": False, "suspicious": False, "details": []}
        auth = {"spf": "PASS", "dkim": "PASS", "dmarc": "PASS", "details": []}
        content = {"indicators": []}
        urls = []
        attachments = []

        score, classification = calculate_risk_score(sender, auth, content, urls, attachments)
        self.assertEqual(classification, "SAFE")
        self.assertLess(score, 20)

    def test_suspicious_classification(self):
        sender = {"mismatch": True, "suspicious": False, "details": ["Mismatch"]}
        auth = {"spf": "PASS", "dkim": "PASS", "dmarc": "PASS", "details": []}
        content = {"indicators": [{"code": "urgency_pressure", "name": "Urgency"}]}
        urls = []
        attachments = []

        score, classification = calculate_risk_score(sender, auth, content, urls, attachments)
        # sender mismatch(20) + urgency(12) = 32 -> SUSPICIOUS
        self.assertEqual(classification, "SUSPICIOUS")
        self.assertGreaterEqual(score, 20)
        self.assertLess(score, 45)

    def test_phishing_classification(self):
        sender = {"mismatch": True, "suspicious": True, "details": ["Brand impersonation"]}
        auth = {"spf": "FAIL", "dkim": "FAIL", "dmarc": "FAIL", "details": []}
        content = {"indicators": [
            {"code": "credential_harvesting", "name": "Credentials"},
            {"code": "otp_theft", "name": "OTP"},
            {"code": "banking_kyc", "name": "Banking"}
        ]}
        urls = [{"risk_classification": "Suspicious", "risk_score": 60}]
        attachments = []

        score, classification = calculate_risk_score(sender, auth, content, urls, attachments)
        self.assertEqual(classification, "PHISHING")
        self.assertGreaterEqual(score, 70)

    def test_scam_classification(self):
        sender = {"mismatch": False, "suspicious": False, "details": []}
        auth = {"spf": "PASS", "dkim": "PASS", "dmarc": "PASS", "details": []}
        content = {"indicators": [
            {"code": "lottery_prize", "name": "Lottery"},
            {"code": "payment_request", "name": "Payment"},
            {"code": "job_offer", "name": "Job"},
            {"code": "credential_harvesting", "name": "Credentials"}
        ]}
        urls = []
        attachments = []

        score, classification = calculate_risk_score(sender, auth, content, urls, attachments)
        # lottery_prize(12) + payment_request(18) + job_offer(12) + credential_harvesting(18) = 60
        self.assertEqual(classification, "SCAM")
        self.assertGreaterEqual(score, 45)
        self.assertLess(score, 70)


class RecommendationTests(unittest.TestCase):
    def test_phishing_recommendations(self):
        recs = generate_recommendations("PHISHING", ["credential_harvesting"], [], [])
        self.assertTrue(any("click" in r.lower() for r in recs))
        self.assertTrue(any("password" in r.lower() or "otp" in r.lower() for r in recs))
        self.assertTrue(any("report" in r.lower() for r in recs))

    def test_safe_recommendations(self):
        recs = generate_recommendations("SAFE", [], [], [])
        self.assertTrue(any("verify" in r.lower() for r in recs))


class FullEmailAnalysisTests(unittest.TestCase):
    def test_analyze_simple_email_text(self):
        email_text = """From: sender@example.com
To: recipient@test.com
Subject: Hello
Date: Mon, 1 Jan 2024 00:00:00 +0000
Message-ID: <test@example.com>

Hello World
"""
        report = analyze_email(email_text, "text", use_gemini=False)

        self.assertIn("id", report)
        self.assertIn("classification", report)
        self.assertIn("risk_score", report)
        self.assertIn("sender", report)
        self.assertIn("subject", report)
        self.assertIn("indicators", report)
        self.assertIn("authentication", report)
        self.assertIn("urls", report)
        self.assertIn("attachments", report)
        self.assertIn("recommendations", report)
        self.assertIn("ai_explanation", report)

    @patch("backend.email_analysis.investigate")
    def test_analyze_phishing_email(self, mock_investigate):
        mock_investigate.return_value = {
            "risk_classification": "Suspicious",
            "findings": [{"category": "url", "severity": "medium", "description": "Suspicious domain"}],
            "redirect_chain": [{"url": "https://paypal-security.xyz/verify"}],
            "final_url": "https://paypal-security.xyz/verify"
        }

        email_text = """From: "PayPal Security" <security@paypal.com>
To: victim@example.com
Subject: URGENT: Your account has been suspended
Date: Mon, 1 Jan 2024 00:00:00 +0000
Message-ID: <test@example.com>
Authentication-Results: mx.example.com; spf=fail; dkim=fail; dmarc=fail

Dear Customer,

Your PayPal account has been suspended due to unusual activity.
You must verify your account immediately by clicking here: https://paypal-security.xyz/verify

Please provide your OTP and password to restore access.

Thanks,
PayPal Security Team
"""
        report = analyze_email(email_text, "text", use_gemini=False)

        self.assertEqual(report["classification"], "PHISHING")
        self.assertGreater(report["risk_score"], 70)

        # Check indicators
        indicator_types = {i["type"] for i in report["indicators"]}
        # The sender analysis looks for domain mismatch in display name vs address
        # The URL analysis catches the suspicious paypal-security.xyz domain
        self.assertIn("SPF_FAILURE", indicator_types)
        self.assertIn("DKIM_FAILURE", indicator_types)
        self.assertIn("DMARC_FAILURE", indicator_types)
        self.assertIn("BANKING_KYC", indicator_types)
        self.assertIn("OTP_THEFT", indicator_types)
        self.assertIn("CREDENTIAL_HARVESTING", indicator_types)
        self.assertIn("URGENCY_PRESSURE", indicator_types)
        self.assertIn("IMPERSONATION", indicator_types)
        # Check that suspicious URL is detected
        url_indicators = [i for i in report["indicators"] if i["type"] in {"MALICIOUS_URL", "SUSPICIOUS_URL"}]
        self.assertTrue(len(url_indicators) > 0, "Should detect suspicious URL")

    def test_analyze_lottery_scam_email(self):
        email_text = """From: "Lottery Commission" <lottery@gmail.com>
To: winner@example.com
Subject: Congratulations! You won $1,000,000!
Date: Mon, 1 Jan 2024 00:00:00 +0000
Message-ID: <test@example.com>
Authentication-Results: mx.example.com; spf=pass; dkim=pass; dmarc=pass

Dear Winner,

Congratulations! You have won a cash prize of $1,000,000 in our lottery!
To claim your reward, please pay a small processing fee of $500.
Send your bank account details and we will transfer the money.

Best regards,
International Lottery Commission
"""
        report = analyze_email(email_text, "text", use_gemini=False)

        self.assertEqual(report["classification"], "SCAM")
        self.assertGreater(report["risk_score"], 45)

        indicator_types = {i["type"] for i in report["indicators"]}
        self.assertIn("LOTTERY_PRIZE", indicator_types)
        self.assertIn("PAYMENT_REQUEST", indicator_types)
        self.assertIn("CREDENTIAL_HARVESTING", indicator_types)
        # May also have banking_kyc from "bank account"

    def test_analyze_safe_email(self):
        email_text = """From: john@company.com
To: jane@company.com
Subject: Meeting tomorrow
Date: Mon, 1 Jan 2024 00:00:00 +0000
Message-ID: <test@example.com>
Authentication-Results: mx.company.com; spf=pass; dkim=pass; dmarc=pass

Hi Jane,

Thanks for the meeting today. Let's follow up tomorrow at 10 AM.

Best,
John
"""
        report = analyze_email(email_text, "text", use_gemini=False)

        self.assertEqual(report["classification"], "SAFE")
        self.assertLess(report["risk_score"], 20)

    def test_analyze_suspicious_email(self):
        email_text = """From: "PayPal Support" <support@paypal.com>
Reply-To: response@unrelated.xyz
Subject: Please review your account
Authentication-Results: mx.example.com; spf=pass; dkim=pass; dmarc=pass

Please review the account update when convenient.
"""
        report = analyze_email(email_text, "text", use_gemini=False)
        self.assertEqual(report["classification"], "SUSPICIOUS")
        self.assertGreaterEqual(report["risk_score"], 20)
        self.assertTrue(report["sender_analysis"]["mismatch"])

    def test_eml_file_parsing(self):
        eml_content = b"""From: sender@example.com
To: recipient@test.com
Subject: Test EML
Date: Mon, 1 Jan 2024 00:00:00 +0000
Message-ID: <test@example.com>
Content-Type: text/plain; charset=utf-8

This is a test EML file.
"""
        msg = parse_eml_file(eml_content)
        self.assertEqual(msg["Subject"], "Test EML")
        self.assertEqual(msg["From"], "sender@example.com")

    def test_oversized_email_rejected(self):
        large_email = "x" * (MAX_EMAIL_SIZE + 1)
        with self.assertRaises(ValueError) as ctx:
            analyze_email(large_email, "text", use_gemini=False)
        self.assertIn("exceeds maximum size", str(ctx.exception))


class EmailApiTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        environment = patch.dict(os.environ, {'EMAIL_ANALYSIS_DB': str(Path(directory.name) / 'email.sqlite3')})
        environment.start(); self.addCleanup(environment.stop)
        original = app.dependency_overrides.copy()
        self.addCleanup(lambda: (app.dependency_overrides.clear(), app.dependency_overrides.update(original)))
        self.owner = ['00000000-0000-0000-0000-000000000001']
        app.dependency_overrides[authenticated_user] = lambda: Principal(self.owner[0], 'test-token')

    def test_email_routes_require_sign_in(self):
        del app.dependency_overrides[authenticated_user]
        with TestClient(app) as client:
            for method, path in [('POST', '/api/email/analyze'), ('POST', '/api/email/upload'), ('GET', '/api/email/results'), ('GET', '/api/email/results/00000000-0000-0000-0000-000000000001')]:
                self.assertEqual(client.request(method, path).status_code, 401)

    def test_saved_reports_are_owner_scoped(self):
        with TestClient(app) as client:
            created = client.post('/api/email/analyze', json={'email_content': 'From: sender@example.com\nSubject: Private report\n\nHello'}).json()
            self.assertEqual(client.get('/api/email/results').json()['total'], 1)
            self.owner[0] = '00000000-0000-0000-0000-000000000002'
            self.assertEqual(client.get('/api/email/results').json()['total'], 0)
            self.assertEqual(client.get('/api/email/results/' + created['id']).status_code, 404)
            self.owner[0] = '00000000-0000-0000-0000-000000000001'
            self.assertEqual(client.get('/api/email/results/' + created['id']).json()['subject'], 'Private report')

    def test_email_openapi_documents_request_and_response(self):
        schema = app.openapi()
        operation = schema["paths"]["/api/email/analyze"]["post"]
        request_schema = operation["requestBody"]["content"]["application/json"]["schema"]
        response_schema = operation["responses"]["200"]["content"]["application/json"]["schema"]
        self.assertTrue(request_schema)
        self.assertTrue(response_schema)
        self.assertIn("email_content", schema["components"]["schemas"]["EmailAnalysisRequest"]["properties"])
        self.assertIn("raw_headers", schema["components"]["schemas"]["EmailAnalysisRequest"]["properties"])
        self.assertIn("risk_scoring", schema["components"]["schemas"]["EmailAnalysisResponse"]["properties"])

    def test_analyze_email_endpoint(self):
        with TestClient(app) as client:
            email_text = """From: test@example.com
To: user@test.com
Subject: Test
Date: Mon, 1 Jan 2024 00:00:00 +0000
Message-ID: <test@example.com>

Hello World
"""
            response = client.post("/api/email/analyze", json={"email_content": email_text})
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertIn("classification", data)
            self.assertIn("risk_score", data)
            self.assertIn("id", data)

    def test_analyze_email_empty_rejected(self):
        with TestClient(app) as client:
            response = client.post("/api/email/analyze", json={"email_content": ""})
            self.assertEqual(response.status_code, 422)

    def test_analyze_raw_headers_only(self):
        with TestClient(app) as client:
            response = client.post("/api/email/analyze", json={"raw_headers": "From: user@example.com\nSubject: Header sample"})
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(data["sender_analysis"]["domains"]["from"], "example.com")
            self.assertEqual(data["authentication"]["evidence_present"], {"spf": False, "dkim": False, "dmarc": False})
            self.assertEqual(data["risk_scoring"]["weights"]["missing_authentication_evidence"], 0)

    def test_request_requires_exactly_one_input(self):
        with TestClient(app) as client:
            self.assertEqual(client.post("/api/email/analyze", json={}).status_code, 422)
            self.assertEqual(client.post("/api/email/analyze", json={"email_content": "From: a@example.com", "raw_headers": "From: a@example.com"}).status_code, 422)

    def test_upload_eml_endpoint(self):
        with TestClient(app) as client:
            eml = b"From: sender@example.com\nSubject: Uploaded\n\nHello"
            response = client.post("/api/email/upload", files={"file": ("sample.eml", eml, "message/rfc822")})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["subject"], "Uploaded")

    def test_analyze_email_oversized_rejected(self):
        with TestClient(app) as client:
            large_email = "x" * (MAX_EMAIL_SIZE + 1)
            response = client.post("/api/email/analyze", json={"email_content": large_email})
            self.assertEqual(response.status_code, 422)

    def test_list_email_analyses(self):
        with TestClient(app) as client:
            response = client.get("/api/email/results")
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertIn("items", data)
            self.assertIn("total", data)

    def test_gmail_auth_endpoint_without_config(self):
        with TestClient(app) as client:
            # Should fail gracefully when not configured
            response = client.get("/api/email/gmail/auth")
            # May return 503 if not configured, or auth URL if configured
            self.assertIn(response.status_code, [200, 503])


if __name__ == "__main__":
    unittest.main()
