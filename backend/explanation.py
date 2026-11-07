"""Deterministic report explanations. No model or network requests."""

from datetime import datetime, timezone

from backend.gemini import evidence_snapshot


VERDICTS = {
    "Low Risk": "No significant threat indicators were identified by the available checks. This is not a guarantee that the website is safe.",
    "Suspicious": "One or more signals need review. Suspicious does not mean confirmed phishing; inspect the findings before sharing sensitive information.",
    "High Risk": "The assessment indicates substantial risk. Avoid sharing sensitive information until the evidence has been reviewed.",
    "Confirmed Malicious": "The investigation found a known-threat match or validated malicious evidence. Avoid interacting with the flagged destination.",
    "Inconclusive": "There is not enough verified information to assess this website reliably. Incomplete checks must not be interpreted as a safe result.",
}
FINDING_MEANINGS = {
    "url": "Unusual domain naming can occur on legitimate sites too. Verify the exact hostname through an independently trusted source.",
    "redirect": "A destination change was observed in an HTTP response. Redirects may be legitimate; review the source and destination domains. HTTPS-to-HTTP changes remove transport encryption.",
    "configuration": "Missing security headers are a website configuration concern, not proof of phishing or fraud. Configuration warnings are separate from the phishing assessment.",
    "tls": "Certificate verification failed. This may reflect expiration, identity, trust-store, or local network issues; it does not by itself prove fraud. Do not bypass certificate warnings.",
    "transport": "HTTP does not encrypt this connection. Do not enter passwords, payment details, or other sensitive information over HTTP.",
    "threat_intelligence": "A threat intelligence source returned a matching listing. Treat the destination as dangerous; a provider test URL can intentionally produce this result.",
}
CHECK_MEANINGS = {
    "url_structure": "The URL naming checks completed. These heuristics cannot identify every impersonation attempt.",
    "redirects": "The redirect chain was traversed to a terminal response. A domain change alone does not establish phishing.",
    "dns": "The hostname resolved to addresses allowed by the public-destination policy. DNS resolution does not establish website legitimacy.",
    "http": "An HTTP response was collected. Reachability and a successful response do not establish safety.",
    "tls": "The HTTPS certificate passed system-trust and hostname verification for this request. Encryption does not establish that the website is legitimate.",
    "security_headers": "The HEAD response was inspected for selected security headers. This is not a complete website vulnerability assessment.",
    "threat_intelligence": "The reputation lookup completed. No matching listing means no known threat was returned by this source, not proof of safety.",
}


def explain_locally(report: dict) -> dict:
    snapshot = evidence_snapshot(report)
    snapshot["evidence"][0]["recommendations"] = report.get("recommendations", [])
    insights = []
    actions = []

    def cited(text, identifier):
        return {"text": text, "evidence_ids": [identifier]}

    for finding in report["findings"]:
        meaning = FINDING_MEANINGS.get(finding["category"], "Review the supporting evidence for this finding.")
        insights.append(cited(f"{finding['description']}. {meaning}", finding["id"]))
    for index, check in enumerate(report["checks"], 1):
        identifier = f"check-{index}"
        name, status = check["name"], check["status"]
        label = name.replace("_", " ").upper() if name in ("dns", "tls", "http") else name.replace("_", " ").capitalize()
        if status == "completed":
            if name == "threat_intelligence" and check.get("matches"):
                text = "The reputation provider returned a known-threat listing for a submitted destination."
            else:
                text = CHECK_MEANINGS.get(name, f"{label} completed; review its evidence for details.")
        elif status == "not_applicable":
            text = f"{label} was not applicable to this request."
        elif status == "blocked":
            text = f"{label} blocked inspection under the destination safety policy. This protects the scanner and does not prove the website is malicious."
        else:
            text = f"{label} was {status}; its result is not a clean bill of health."
            if check.get("reason"):
                text += f" {check['reason']}"
            actions.append(cited(f"Review the {label.lower()} check details, resolve the unavailable or failed check where possible, and investigate again.", identifier))
        insights.append(cited(text, identifier))

    for recommendation in report.get("recommendations", []):
        actions.append(cited(recommendation, "assessment"))
    if not actions:
        actions.append(cited("Verify the intended hostname independently before providing sensitive information. Review the report limitations even when no threats are detected.", "assessment"))
    summary = VERDICTS.get(report["risk_classification"], VERDICTS["Inconclusive"])
    configuration_count = len(report.get("assessment", {}).get("configuration_finding_ids", []))
    if configuration_count:
        summary += f" There are {configuration_count} separate configuration findings; review them even when the phishing assessment is Low Risk."
    return {
        "status": "completed", "provider": "Local rules", "model": "Rule-based explanation",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": cited(summary, "assessment"),
        "explanations": insights, "next_steps": actions, "evidence": snapshot["evidence"],
    }
