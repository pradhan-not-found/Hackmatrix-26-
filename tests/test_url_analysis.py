import unittest
from unittest.mock import patch

from backend.investigation import investigate
from backend.network import normalize_url
from backend.url_analysis import analyze_url, analyze_redirect, domain_info


class URLAnalysisTests(unittest.TestCase):
    def test_public_suffix_and_private_tenant_boundaries(self):
        self.assertEqual(domain_info("login.bank.co.uk")["registrable_domain"], "bank.co.uk")
        self.assertEqual(domain_info("tenant.github.io")["registrable_domain"], "tenant.github.io")
        self.assertIsNone(domain_info("host.unknownsuffix")["registrable_domain"])
        self.assertTrue(domain_info("8.8.8.8")["is_ip"])

    def test_official_domains_and_legitimate_international_names_are_not_strong_signals(self):
        for url in ("https://accounts.google.com/login", "https://www.paypal.com/signin",
                    "https://docs.example.org/articles/paypal", "https://bücher.de/", "https://apply.com/"):
            with self.subTest(url=url):
                result = analyze_url(normalize_url(url))
                self.assertFalse(any(item["strength"] in ("moderate", "strong") for item in result["indicators"]))

    def test_deceptive_subdomains_and_typos_are_evidence_backed(self):
        deceptive = analyze_url("https://paypal.com.attacker.com/")
        self.assertTrue(any(item["code"] == "deceptive_subdomain" and item["strength"] == "strong" for item in deceptive["indicators"]))
        for url in ("https://paypa1.com/login", "https://payapl.com/verify", "https://paypal-security.com/account"):
            with self.subTest(url=url):
                self.assertTrue(any(item["strength"] == "moderate" for item in analyze_url(url)["indicators"]))
        no_context = analyze_url("https://paypa1.com/")
        self.assertFalse(any(item["strength"] != "weak" for item in no_context["indicators"]))

    def test_unicode_brand_confusable_and_mixed_script(self):
        result = analyze_url(normalize_url("https://раураl.com/"))
        self.assertTrue(any(item["code"] == "brand_homoglyph" and item["strength"] == "strong" for item in result["indicators"]))
        self.assertTrue(any(item["code"] == "mixed_script" for item in result["indicators"]))
        self.assertEqual(domain_info(normalize_url("https://faß.de/").split('/')[2])["unicode_hostname"], "faß.de")

    def test_embedded_destinations_are_only_inspected_offline(self):
        with patch("socket.getaddrinfo", side_effect=AssertionError("No network permitted")):
            result = analyze_url("https://example.com/?next=https%253A%252F%252Fevil.com%252Flogin")
        embedded = [item for item in result["indicators"] if item["code"] == "embedded_redirect"]
        self.assertEqual(len(embedded), 1)
        self.assertEqual(embedded[0]["evidence"]["destination_domain"], "evil.com")
        self.assertFalse(embedded[0]["evidence"]["followed"])
        self.assertFalse(analyze_url("https://example.com/?next=/account")["indicators"])

    def test_redirect_boundaries_and_downgrade_are_distinct(self):
        self.assertFalse(analyze_redirect("https://login.bank.co.uk/", "https://www.bank.co.uk/"))
        external = analyze_redirect("https://a.github.io/", "https://b.github.io/")
        self.assertEqual(external[0]["strength"], "weak")
        downgrade = analyze_redirect("https://example.com/", "http://example.com/")
        self.assertEqual(downgrade[0]["code"], "https_downgrade")
        self.assertEqual(downgrade[0]["kind"], "security_configuration")

    def test_actual_correlated_redirect_produces_high_risk_without_confirmation(self):
        source, target = "https://paypal.com.attacker.com/", "https://different.org/"
        def response(url, addresses):
            return {"url": url, "status": 302 if url == source else 200,
                    "headers": {"location": target} if url == source else {}, "tls": {"verified": True}, "address": addresses[0], "html": {"status": "completed", "text": "<title>Example</title>"}}
        with patch("backend.investigation.public_addresses", return_value=["8.8.8.8"]), \
                patch("backend.investigation.fetch", side_effect=response), \
                patch("backend.investigation.reputation", return_value={"status": "completed", "matches": []}):
            result = investigate(source)
        self.assertEqual(result["risk_classification"], "High Risk")
        self.assertEqual(result["assessment"]["signal_groups"], ["hostname_identity", "redirect_behavior"])
        self.assertEqual(len(result["url_analysis"]), 2)

    def test_ordinary_external_redirect_and_http_warning_are_not_phishing(self):
        source, target = "https://example.com/", "http://example.org/"
        def response(url, addresses):
            return {"url": url, "status": 302 if url == source else 200,
                    "headers": {"location": target} if url == source else {},
                    "tls": {"verified": True} if url == source else None, "address": addresses[0], "html": {"status": "completed", "text": "<title>Example</title>"}}
        with patch("backend.investigation.public_addresses", return_value=["8.8.8.8"]), \
                patch("backend.investigation.fetch", side_effect=response), \
                patch("backend.investigation.reputation", return_value={"status": "completed", "matches": []}):
            result = investigate(source)
        self.assertEqual(result["risk_classification"], "Low Risk")
        self.assertTrue(any(finding.get("code") == "https_downgrade" for finding in result["findings"]))
        self.assertTrue(result["assessment"]["configuration_finding_ids"])
