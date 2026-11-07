import http.client
import ssl
import time
from datetime import datetime, timezone
from urllib.parse import urljoin, urlsplit
from uuid import uuid4

from backend.network import UnsafeURL, fetch, normalize_url, public_addresses
from backend.threat_intelligence import reputation
from backend.explanation import explain_locally
from backend.assessment import assess


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


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

    def finding(category, severity, description, evidence, recommendation, source="local checks", **metadata):
        report["findings"].append({
            "id": f"finding-{len(report['findings']) + 1}", "category": category,
            "severity": severity, "description": description, "evidence": evidence,
            "source": source, "observed_at": now(),
            "kind": "threat_indicator" if category in ("url", "threat_intelligence") else "security_configuration",
            "strength": "weak", **metadata,
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
    reputation_urls = [normalized]
    visited = set()
    started = time.monotonic()
    redirects_complete = False
    redirect_error = "Redirect traversal did not complete."
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
            stage = "dns"
            addresses = public_addresses(parts.hostname, 443 if parts.scheme == "https" else 80)
            if current not in reputation_urls:
                reputation_urls.append(current)
            report["checks"].append({"name": "dns", "status": "completed", "url": current,
                                     "addresses": addresses})
            stage = "http"
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
            report["final_url"] = current
            redirects_complete = True
            if not 200 <= result["status"] < 300:
                report["limitations"].append(f"Target returned HTTP {result['status']}; HEAD may be unsupported.")
                report["checks"].append({"name": "http", "status": "unavailable", "url": current,
                                         "reason": f"HTTP {result['status']} does not provide a successful inspection response."})
                report["checks"].append({"name": "security_headers", "status": "not_run", "url": current,
                                         "reason": "Headers on an unsuccessful response are not assessed as the website's normal policy."})
                break
            required = ["content-security-policy", "x-content-type-options"]
            if parts.scheme == "https":
                required.append("strict-transport-security")
            missing = [name for name in required if name not in result["headers"]]
            report["checks"].append({"name": "security_headers", "status": "completed", "missing": missing})
            if missing:
                finding("configuration", "info", "Security headers absent from HEAD response", missing,
                        "Website owner: review security header configuration; absence alone is not evidence of phishing.")
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
            report["checks"].append({"name": stage, "status": "failed", "url": current,
                                     "error": type(exc).__name__})
            report["limitations"].append("Network inspection could not complete.")
            break
        except http.client.HTTPException:
            report["checks"].append({"name": "http", "status": "failed", "error": "Invalid HTTP response"})
            break

    report["checks"].append({"name": "redirects", "status": "completed" if redirects_complete else "partial",
                             "reason": None if redirects_complete else redirect_error})
    intelligence = reputation(reputation_urls)
    report["checks"].append({"name": "threat_intelligence", **intelligence})
    if intelligence["status"] != "completed":
        report["limitations"].append(intelligence["reason"])
    elif intelligence["matches"]:
        finding("threat_intelligence", "critical", "URL matched a known threat listing",
                intelligence["matches"], "Do not interact with the flagged destination.", intelligence["source"],
                strength="strong", signal_group="known_threat", verification="provider_match")

    assess(report)
    report.update(status="completed", completed_at=now())
    report["ai_explanation"] = explain_locally(report)
    return report
