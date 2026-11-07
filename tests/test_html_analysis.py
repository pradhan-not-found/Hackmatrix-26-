import json
import unittest
from unittest.mock import patch

from backend.html_analysis import analyze_html


class HTMLAnalysisTests(unittest.TestCase):
    def test_benign_same_site_login_and_payment_provider_are_not_phishing(self):
        for url, html in (
            ("https://example.com/", '<title>Example login</title><form action="/session" method="post"><input type="password"></form>'),
            ("https://www.paypal.com/", '<title>PayPal login</title><form method="post" action="https://auth.example.org/login"><input type="password"></form>'),
            ("https://shop.example.com/", '<form method="post" action="https://payments.example.org"><input autocomplete="cc-number"></form>'),
        ):
            with self.subTest(url=url):
                result = analyze_html(html, url)
                self.assertFalse(any(item["strength"] in ("moderate", "strong") for item in result["findings"]))

    def test_brand_mismatch_needs_sensitive_form_context(self):
        article = analyze_html('<title>PayPal integration guide</title>', 'https://example.org/')
        self.assertEqual(article['findings'][0]['strength'], 'weak')
        result = analyze_html('<title>PayPal login</title><form method="post"><input type="password"></form>', 'https://paypal.com.attacker.com/')
        self.assertTrue(any(item['code'] == 'page_brand_mismatch' and item['strength'] == 'strong' for item in result['findings']))

    def test_insecure_forms_and_external_destinations_have_impact_and_remediation(self):
        result = analyze_html('<title>PayPal login</title><form action="http://other.org/send" method="get"><input type="password" value="never-store-this"></form>', 'https://example.com/')
        codes = {item['code'] for item in result['findings']}
        self.assertTrue({'insecure_sensitive_form', 'external_sensitive_form', 'sensitive_form_get'} <= codes)
        for item in result['findings']:
            self.assertTrue(item['impact'])
            self.assertTrue(item['remediation'])
        self.assertNotIn('never-store-this', json.dumps(result))

    def test_base_formaction_and_external_control_ownership(self):
        html = '<input type="password" form="login"><form id="login" method="post" action="/session"><button formaction="http://other.org/send">Go</button></form><base href="https://identity.example.org/">'
        result = analyze_html(html, 'https://example.com/')
        self.assertEqual(result['forms'][0]['destination'], 'https://identity.example.org/session')
        self.assertTrue(result['forms'][0]['has_password'])
        self.assertTrue(any(item['code'] == 'insecure_sensitive_form' for item in result['findings']))

    def test_mixed_resources_and_refresh_are_never_followed(self):
        html = '<script src="http://assets.example.com/app.js"></script><img src="http://images.example.com/x"><meta http-equiv="refresh" content="0; url=http://127.0.0.1/private">'
        with patch('socket.getaddrinfo', side_effect=AssertionError('Parser must not access network')):
            result = analyze_html(html, 'https://example.com/')
        self.assertEqual(len(result['mixed_content']), 2)
        self.assertFalse(result['meta_refreshes'][0]['followed'])

    def test_inert_content_and_input_values_are_ignored_even_with_malformed_html(self):
        html = '<script>document.write("<form><input type=password>")</script><template><form><input type="password"></form></template><form method="post"><input type="password" value="secret"><p>Unclosed'
        result = analyze_html(html, 'https://example.com/')
        self.assertEqual(result['form_count'], 1)
        self.assertNotIn('secret', json.dumps(result))
        self.assertFalse(result['findings'])

    def test_limits_and_invalid_actions_do_not_crash_or_create_unbounded_forms(self):
        result = analyze_html('<form action="javascript:alert(1)"><input type="password"></form>' * 120, 'https://example.com/')
        self.assertTrue(result['limited'])
        self.assertLessEqual(len(result['forms']), 200)
        with self.assertRaises(ValueError):
            analyze_html('<div>' * 10001, 'https://example.com/')
