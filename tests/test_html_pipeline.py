import json
import unittest
from unittest.mock import patch

from backend.investigation import investigate


class HTMLPipelineTests(unittest.TestCase):
    def inspect(self, html, url="https://example.com/", status="completed"):
        response = {"url": url, "status": 200, "headers": {}, "address": "8.8.8.8", "tls": {"verified": True},
                    "html": {"status": status, "text": html, "bytes_read": len(html)}}
        with patch('backend.investigation.public_addresses', return_value=['8.8.8.8']), \
                patch('backend.investigation.fetch', return_value=response), \
                patch('backend.investigation.reputation', return_value={'status': 'completed', 'matches': []}):
            return investigate(url)

    def test_benign_static_login_and_configuration_only_findings(self):
        for html in ('<title>Example</title>', '<form method="post"><input type="password"></form>',
                     '<form method="post" action="http://example.com/session"><input type="password"></form>'):
            with self.subTest(html=html):
                report = self.inspect(html)
                self.assertEqual(report['risk_classification'], 'Low Risk')
                self.assertTrue(report['page_analysis'])
                self.assertEqual(next(check for check in report['evidence_coverage']['checks'] if check['name'] == 'html_inspection')['status'], 'completed')

    def test_page_evidence_correlates_with_hostname_but_does_not_confirm_maliciousness(self):
        report = self.inspect('<title>PayPal login</title><form method="post"><input type="password"></form>', 'https://paypal.com.attacker.com/')
        self.assertEqual(report['risk_classification'], 'High Risk')
        self.assertIn('page_identity', report['assessment']['signal_groups'])
        self.assertTrue(any(finding['category'] == 'html' and finding['impact'] for finding in report['findings']))

    def test_partial_unavailable_and_unparseable_pages_cannot_be_low_risk(self):
        for html, status in (('', 'unavailable'), ('<form></form>' * 101, 'completed'), ('<div>' * 10001, 'completed')):
            with self.subTest(status=status, length=len(html)):
                report = self.inspect(html, status=status)
                self.assertEqual(report['risk_classification'], 'Inconclusive')

    def test_raw_html_input_values_and_scripts_are_not_saved(self):
        html = '<script>window.privateToken="do-not-save-script"</script><form method="post"><input type="password" value="do-not-save-value"></form>'
        report = self.inspect(html)
        saved = json.dumps(report)
        self.assertNotIn('do-not-save-script', saved)
        self.assertNotIn('do-not-save-value', saved)
        self.assertNotIn('<form', saved)
        self.assertFalse(report['page_analysis']['forms'][0]['submitted'])
