import unittest
from unittest.mock import patch

from backend.assessment import IMPLEMENTED, assess
from backend.investigation import investigate


def report(findings=None):
    return {"findings": findings or [], "checks": [{"name": name, "status": "completed"} for name in IMPLEMENTED]}


def indicator(identifier, group, strength="strong"):
    return {"id": identifier, "category": "url", "kind": "threat_indicator", "severity": "high",
            "strength": strength, "signal_group": group, "evidence": {"indicator": identifier}}


class AssessmentTests(unittest.TestCase):
    def test_critical_configuration_never_confirms_maliciousness(self):
        value = report([{"id": "config", "category": "configuration", "severity": "critical",
                         "kind": "security_configuration", "verification": "provider_match", "evidence": ["bad config"]}])
        assess(value)
        self.assertEqual(value["risk_classification"], "Low Risk")
        self.assertEqual(value["assessment"]["configuration_finding_ids"], ["config"])

    def test_high_risk_requires_distinct_groups_and_one_strong_indicator(self):
        cases = [([indicator("a", "identity"), indicator("b", "identity")], "Suspicious"),
                 ([indicator("a", "identity"), indicator("b", "redirect", "moderate")], "High Risk"),
                 ([indicator("a", "identity", "moderate"), indicator("b", "redirect", "moderate")], "Suspicious"),
                 ([indicator("a", "identity", "weak")], "Low Risk")]
        for findings, expected in cases:
            with self.subTest(expected=expected, findings=findings):
                value = report(findings)
                assess(value)
                self.assertEqual(value["risk_classification"], expected)

    def test_confirmation_requires_explicit_threat_provider_evidence(self):
        finding = {**indicator("match", "known_threat"), "category": "threat_intelligence"}
        value = report([finding])
        assess(value)
        self.assertEqual(value["risk_classification"], "Suspicious")
        finding["verification"] = "provider_match"
        assess(value)
        self.assertEqual(value["risk_classification"], "Confirmed Malicious")

    def test_missing_partial_and_unimplemented_coverage_is_explicit(self):
        value = report()
        value["checks"] = [item for item in value["checks"] if item["name"] != "tls"]
        value["checks"].append({"name": "http", "status": "unavailable"})
        assess(value)
        states = {check["name"]: check["status"] for check in value["evidence_coverage"]["checks"]}
        self.assertEqual(states["http"], "partial")
        self.assertEqual(states["tls"], "not_run")
        self.assertEqual(states["certificate_revocation"], "not_implemented")
        self.assertEqual(value["risk_classification"], "Inconclusive")

    def test_error_response_does_not_produce_low_risk_or_header_findings(self):
        for status in (301, 403, 405, 500):
            with self.subTest(status=status), patch("backend.investigation.public_addresses", return_value=["8.8.8.8"]), \
                    patch("backend.investigation.fetch", return_value={"url": "https://example.com/", "status": status,
                          "headers": {}, "tls": {"verified": True}, "address": "8.8.8.8"}), \
                    patch("backend.investigation.reputation", return_value={"status": "completed", "matches": []}):
                value = investigate("example.com")
                self.assertEqual(value["risk_classification"], "Inconclusive")
                self.assertFalse(value["evidence_coverage"]["network_complete"])
                self.assertFalse(any(finding["category"] == "configuration" for finding in value["findings"]))
