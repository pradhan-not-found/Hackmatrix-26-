"""Evidence-based phishing assessment, separate from configuration warnings."""

IMPLEMENTED = ("url_structure", "dns", "http", "tls", "redirects", "security_headers", "threat_intelligence", "html_inspection", "certificate_key_strength", "certificate_signature")
UNIMPLEMENTED = ("certificate_revocation", "certificate_transparency")


def assess(report: dict) -> None:
    coverage = []
    for name in IMPLEMENTED:
        results = [check for check in report["checks"] if check["name"] == name]
        states = {check["status"] for check in results}
        if not states:
            status = "not_run"
        elif states <= {"completed", "not_applicable"}:
            status = "completed" if "completed" in states else "not_applicable"
        elif len(states) > 1:
            status = "partial"
        else:
            status = next(iter(states))
        coverage.append({"name": name, "status": status,
                         "check_ids": [f"check-{i}" for i, check in enumerate(report["checks"], 1) if check["name"] == name]})
    coverage.extend({"name": name, "status": "not_implemented", "check_ids": []} for name in UNIMPLEMENTED)
    states = {item["name"]: item["status"] for item in coverage}
    network_complete = all(states[name] in ("completed", "not_applicable")
                           for name in ("dns", "http", "tls", "redirects", "security_headers"))
    reputation_available = states["threat_intelligence"] == "completed"
    complete = (network_complete and reputation_available and states["url_structure"] == "completed"
                and states["html_inspection"] in ("completed", "not_applicable"))

    indicators = [finding for finding in report["findings"] if finding.get("kind") == "threat_indicator"]
    confirmed = [finding for finding in indicators if finding["category"] == "threat_intelligence"
                 and finding.get("verification") == "provider_match" and finding.get("evidence")]
    significant = [finding for finding in indicators if finding.get("strength") in ("moderate", "strong")]
    groups = {finding.get("signal_group") for finding in significant if finding.get("signal_group")}
    if confirmed:
        classification, rule, evidence = "Confirmed Malicious", "verified_provider_match", confirmed
    elif len(groups) >= 2 and any(finding.get("strength") == "strong" for finding in significant):
        classification, rule, evidence = "High Risk", "corroborating_signal_groups", significant
    elif significant:
        classification, rule, evidence = "Suspicious", "significant_threat_indicator", significant
    elif complete:
        classification, rule, evidence = "Low Risk", "no_significant_indicators_with_core_coverage", []
    else:
        classification, rule, evidence = "Inconclusive", "insufficient_core_coverage", []
    report["risk_classification"] = classification
    report["assessment"] = {
        "policy_version": "2.1", "rule": rule, "evidence_ids": [finding["id"] for finding in evidence],
        "signal_groups": sorted(groups), "scope": "Phishing and malicious-destination indicators, not overall website security",
        "configuration_finding_ids": [finding["id"] for finding in report["findings"] if finding.get("kind") == "security_configuration"],
        "limitations": "Heuristic classifications are not calibrated probabilities. Low Risk does not prove safety.",
    }
    report["evidence_coverage"] = {
        "network_complete": network_complete, "reputation_available": reputation_available,
        "checks": coverage, "scope": "Core coverage excludes explicitly unimplemented checks.",
    }
