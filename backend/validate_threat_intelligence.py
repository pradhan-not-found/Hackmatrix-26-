"""Live provider checks: python -m backend.validate_threat_intelligence."""

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from backend.threat_intelligence import api_key, reputation

BENIGN_URL = "https://example.com/"
# Google's v4 reference implementation documents this exact URL as a test match.
MALICIOUS_TEST_URL = "http://testsafebrowsing.appspot.com/apiv4/ANY_PLATFORM/MALWARE/URL/"
TEST_SOURCE = "https://github.com/google/safebrowsing/blob/master/README.md"


def validate() -> dict:
    cases = []
    configured = bool(api_key())
    for name, url, expect_match in (("benign", BENIGN_URL, False),
                                   ("provider_malicious_test", MALICIOUS_TEST_URL, True)):
        if not configured:
            cases.append({"case": name, "url": url, "outcome": "skipped",
                          "reason": "Configure GOOGLE_SAFE_BROWSING_API_KEY to validate live matches."})
            continue
        result = reputation([url])
        matches = result.get("matches", [])
        expected = any(match.get("threatType") == "MALWARE" for match in matches) if expect_match else not matches
        passed = result["status"] == "completed" and expected
        cases.append({"case": name, "url": url, "outcome": "passed" if passed else "failed",
                      "expected": "MALWARE match" if expect_match else "Completed lookup with no matches",
                      "result": result})

    # Exercise a real rejected-credential response without altering the configured key.
    failure = reputation([BENIGN_URL], key_override="hackmatrix-intentionally-invalid-validation-key")
    passed = (failure["status"] == "unavailable"
              and failure.get("error_code") == "configuration_error"
              and failure.get("http_status") in (400, 401, 403)
              and "matches" not in failure)
    cases.append({"case": "provider_failure", "url": BENIGN_URL,
                  "expected": "Rejected credentials reported as unavailable, never clean",
                  "outcome": "passed" if passed else "failed", "result": failure})
    return {"mode": "live", "checked_at": datetime.now(timezone.utc).isoformat(),
            "test_url_source": TEST_SOURCE, "configured": configured,
            "passed": all(case["outcome"] == "passed" for case in cases), "cases": cases}


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate live Safe Browsing lookups without visiting test destinations.")
    parser.add_argument("--output", type=Path, default=Path("data/threat-intelligence-validation.json"))
    args = parser.parse_args()
    results = validate()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    for case in results["cases"]:
        result = case.get("result", {})
        detail = case.get("reason") or result.get("reason") or case["expected"]
        print(f"{case['outcome'].upper()}: {case['case']} - {detail}")
    print(f"Live validation evidence saved to {args.output}")
    return 0 if results["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
