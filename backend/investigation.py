import json
import os
import http.client
import ssl
import time
from datetime import datetime, timezone
from urllib.parse import urlencode, urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener
from uuid import uuid4

from backend.network import UnsafeURL, fetch, normalize_url, public_addresses


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def reputation(urls: list[str]) -> dict:
    """Optional Google Safe Browsing v4 lookup; submitted URLs leave this service."""
    key = os.getenv("GOOGLE_SAFE_BROWSING_API_KEY")
    if not key:
        return {"status": "unavailable", "reason": "Google Safe Browsing API key not configured"}
    endpoint = "https://safebrowsing.googleapis.com/v4/threatMatches:find?" + urlencode({"key": key})
    payload = {"client": {"clientId": "hackmatrix", "clientVersion": "1.0"},
               "threatInfo": {"threatTypes": ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"],
                              "platformTypes": ["ANY_PLATFORM"], "threatEntryTypes": ["URL"],
                              "threatEntries": [{"url": url} for url in urls]}}
    request = Request(endpoint, data=json.dumps(payload).encode(),
                      headers={"Content-Type": "application/json"})
    try:
        # Do not inherit environment proxies, and do not follow provider redirects.
        class NoRedirect(HTTPRedirectHandler):
            def redirect_request(self, req, fp, code, msg, headers, newurl):
                return None

        with build_opener(ProxyHandler({}), NoRedirect()).open(request, timeout=5) as response:
            raw = response.read(262145)
        if len(raw) > 262144:
            raise ValueError("Provider response too large")
        data = json.loads(raw)
        if not isinstance(data, dict):
            raise ValueError("Invalid provider response")
        matches = data.get("matches", [])
        if not isinstance(matches, list) or not all(
            isinstance(match, dict) and isinstance(match.get("threat"), dict)
            and match["threat"].get("url") in urls and match.get("threatType")
            for match in matches
        ):
            raise ValueError("Invalid provider response")
        return {"status": "completed", "source": "Google Safe Browsing v4", "matches": matches}
    except (OSError, ValueError, TypeError):
        return {"status": "unavailable", "reason": "Threat intelligence provider request failed"}


def investigate(url: str) -> dict:
    normalized = normalize_url(url)
    report = {
        "id": str(uuid4()), "status": "running", "submitted_url": url,
        "normalized_url": normalized, "created_at": now(), "completed_at": None,
        "risk_classification": "Inconclusive", "findings": [], "checks": [],
        "redirect_chain": [], "recommendations": [],
        "limitations": [
            "No detected threats does not establish safety; HTTPS does not establish legitimacy.",
            "HEAD requests only; page content, scripts, downloads and vulnerabilities are not inspected.",
            "Certificate revocation, Certificate Transparency and full chain analysis are not implemented.",
        ],
    }

    def finding(category, severity, description, evidence, recommendation, source="local checks"):
        report["findings"].append({
            "id": f"finding-{len(report['findings']) + 1}", "category": category,
            "severity": severity, "description": description, "evidence": evidence,
            "source": source, "observed_at": now(),
        })
        if recommendation not in report["recommendations"]:
            report["recommendations"].append(recommendation)

    host = urlsplit(normalized).hostname
    indicators = []
    if "xn--" in host:
        indicators.append("Internationalized hostname; verify the intended organisation")
    if host.count("-") >= 4 or host.count(".") >= 5:
        indicators.append("Unusual hostname structure")
    if indicators:
        finding("url", "low", "URL characteristics warrant manual review", indicators,
                "Verify the hostname through an independently trusted source.")
    report["checks"].append({"name": "url_structure", "status": "completed"})
    current = normalized
    visited = set()
    started = time.monotonic()
    for hop in range(6):
        if current in visited:
            report["limitations"].append("Redirect loop prevented completion.")
            break
        if time.monotonic() - started >= 25:
            report["limitations"].append("Investigation network budget exhausted.")
            break
        visited.add(current)
        try:
            parts = urlsplit(current)
            addresses = public_addresses(parts.hostname, 443 if parts.scheme == "https" else 80)
            report["checks"].append({"name": "dns", "status": "completed", "url": current,
                                     "addresses": addresses})
            result = fetch(current, addresses)
            report["redirect_chain"].append(result)
            report["checks"].append({"name": "http", "status": "completed", "url": current,
                                     "http_status": result["status"]})
            report["checks"].append({"name": "tls", "status": "completed" if result["tls"] else "not_applicable",
                                     "url": current, "details": result["tls"]})
            if parts.scheme == "http":
                finding("transport", "medium", "Connection uses unencrypted HTTP", current,
                        "Avoid submitting credentials over HTTP.")
            location = result["headers"].get("location")
            if result["status"] in (301, 302, 303, 307, 308) and location:
                if hop == 5:
                    report["limitations"].append("Redirect limit reached.")
                    break
                current = normalize_url(urljoin(current, location))
                continue
            if result["status"] >= 400:
                report["limitations"].append(f"Target returned HTTP {result['status']}; HEAD may be unsupported.")
            required = ["content-security-policy", "x-content-type-options"]
            if parts.scheme == "https":
                required.append("strict-transport-security")
            missing = [name for name in required if name not in result["headers"]]
            report["checks"].append({"name": "security_headers", "status": "completed", "missing": missing})
            if missing:
                finding("configuration", "info", "Security headers absent from HEAD response", missing,
                        "Website owner: review security header configuration; absence alone is not evidence of phishing.")
            report["final_url"] = current
            break
        except UnsafeURL as exc:
            report["checks"].append({"name": "destination_safety", "status": "blocked", "error": str(exc)})
            report["limitations"].append("Inspection blocked by destination safety policy.")
            break
        except ssl.SSLCertVerificationError as exc:
            finding("tls", "medium", "TLS certificate verification failed", exc.verify_message,
                    "Do not bypass certificate warnings; ask the website owner to investigate.")
            report["checks"].append({"name": "tls", "status": "failed", "url": current,
                                     "error": exc.verify_message})
            break
        except (OSError, ValueError, TimeoutError) as exc:
            report["checks"].append({"name": "network", "status": "failed", "url": current,
                                     "error": type(exc).__name__})
            report["limitations"].append("Network inspection could not complete.")
            break
        except http.client.HTTPException:
            report["checks"].append({"name": "http", "status": "failed", "error": "Invalid HTTP response"})
            break

    intelligence = reputation([result["url"] for result in report["redirect_chain"]] or [normalized])
    report["checks"].append({"name": "threat_intelligence", **intelligence})
    if intelligence["status"] != "completed":
        report["limitations"].append(intelligence["reason"])
    elif intelligence["matches"]:
        finding("threat_intelligence", "critical", "URL matched a known threat listing",
                intelligence["matches"], "Do not interact with the flagged destination.", intelligence["source"])

    severities = [item["severity"] for item in report["findings"]]
    complete = "final_url" in report and intelligence["status"] == "completed"
    if "critical" in severities:
        classification = "Confirmed Malicious"
    elif any(level in severities for level in ("low", "medium", "high")):
        classification = "Suspicious"
    elif complete:
        classification = "Low Risk"
    else:
        classification = "Inconclusive"
    report.update(status="completed", completed_at=now(), risk_classification=classification)
    report["evidence_coverage"] = {
        "network_complete": "final_url" in report,
        "reputation_available": intelligence["status"] == "completed",
    }
    return report
