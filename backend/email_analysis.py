"""Email scam detection engine with multi-layer analysis."""

import email
import email.header
import email.message
import email.policy
import email.utils
import re
import json
import base64
import quopri
from datetime import datetime, timezone
from typing import Literal
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4

from backend.url_analysis import analyze_url
from backend.network import normalize_url
from backend.investigation import investigate
from backend.gemini import explain_email_analysis
from backend.threat_intelligence import reputation


MAX_EMAIL_SIZE = 500000  # 500KB max email size
MAX_URLS_TO_ANALYZE = 10  # Limit URLs analyzed per email


# Suspicious TLDs often used in phishing
SUSPICIOUS_TLDS = {
    "zip", "mov", "xyz", "top", "click", "country", "gq", "tk", "ml", "cf",
    "work", "support", "rest", "loan", "review", "men", "date", "racing",
    "stream", "download", "party", "science", "accountant", "trade", "win",
    "bid", "cricket", "faith", "info", "online", "site", "tech", "store",
    "space", "website", "host", "press", "club", "link", "live", "fun"
}

# High-value brands commonly targeted for impersonation
TARGET_BRANDS = {
    "paypal", "sbi", "hdfc", "icici", "paytm", "amazon", "microsoft",
    "apple", "google", "netflix", "aadhaar", "facebook", "instagram",
    "whatsapp", "linkedin", "twitter", "github", "bankofamerica", "chase",
    "wellsfargo", "citibank", "hsbc", "barclays", "santander", "amex",
    "mastercard", "visa", "discover", "stripe", "square", "coinbase",
    "binance", "kraken", "dhl", "fedex", "ups", "usps", "amazonaws",
    "azure", "cloudflare", "digitalocean", "heroku", "vercel", "netlify"
}

# Email indicators for NLP analysis
EMAIL_INDICATORS = [
    ("urgency_pressure", re.compile(r"\b(?:immediately|urgent|act now|within \d+ hours?|expires today|right away|final warning|suspended unless|last chance|limited time)\b", re.I), "Urgency or consequence pressure"),
    ("credential_harvesting", re.compile(r"\b(?:password|passcode|login credentials|card details|bank account details|cvv|pin number|social security|ssn|mother'?s maiden name)\b", re.I), "Sensitive credential or payment detail request"),
    ("otp_theft", re.compile(r"\b(?:otp|one[ -]time password|verification code|security code|auth code|2fa code|mfa code)\b", re.I), "One-time code or verification language"),
    ("payment_request", re.compile(r"\b(?:pay|payment|transfer|wire|fee|deposit|refund|upi|gift card|crypto(?:currency)?|bitcoin|ethereum|wallet address)\b", re.I), "Payment, transfer, or refund language"),
    ("banking_kyc", re.compile(r"\b(?:kyc|bank account|account (?:blocked|suspended|frozen)|update (?:your )?(?:bank )?account|verify (?:your )?account|unusual activity|suspicious activity)\b", re.I), "Banking or account verification language"),
    ("lottery_prize", re.compile(r"\b(?:lottery|won|winner|prize|cash prize|claim (?:your )?(?:reward|gift)|congratulations|selected|chosen)\b", re.I), "Prize, lottery, or reward claim language"),
    ("job_offer", re.compile(r"\b(?:job offer|work from home|hiring now|daily income|part[ -]time job|registration fee|advance fee|training fee)\b", re.I), "Unsolicited job or income offer language"),
    ("impersonation", re.compile(r"\b(?:dear customer|bank security|support team|tax department|delivery service|government notice|official notice|security alert|account team|billing department)\b", re.I), "Generic authority or service identity claim"),
    ("threat_intimidation", re.compile(r"\b(?:legal action|lawsuit|arrest|police|court|fine|penalty|terminate|close your account|permanent(?:ly)? block)\b", re.I), "Threat of legal or punitive action"),
    ("fake_invoice", re.compile(r"\b(?:invoice|receipt|billing|amount due|outstanding balance|past due|overdue|payment overdue)\b", re.I), "Fake invoice or billing language"),
    ("package_delivery", re.compile(r"\b(?:package|delivery|shipment|tracking|parcel|dhl|fedex|ups|usps|courier|re-delivery|delivery attempt)\b", re.I), "Package delivery notification language"),
    ("account_compromise", re.compile(r"\b(?:compromised|hacked|breach|unauthorized access|suspicious login|new device|login from|security breach)\b", re.I), "Account compromise alert language"),
]

# Dangerous attachment extensions
DANGEROUS_EXTENSIONS = {
    "exe", "bat", "cmd", "com", "scr", "pif", "vbs", "js", "jse", "wsf",
    "wsh", "ps1", "psm1", "psd1", "msi", "msp", "mst", "hta", "cpl",
    "dll", "sys", "drv", "ocx", "ax", "mui", "tlb", "olb", "acm",
    "docm", "xlsm", "pptm", "dotm", "xltm", "potm", "ppam", "ppsm",
    "sldm", "docb", "xla", "xlam", "xll", "xlw", "ppt", "pot", "pps",
    "ppam", "ppsm", "sldx", "sldm", "thmx", "jar", "apk", "ipa",
    "deb", "rpm", "dmg", "pkg", "app", "sh", "bash", "zsh", "fish",
    "py", "pyc", "pyo", "pyd", "rb", "pl", "php", "asp", "aspx",
    "jsp", "html", "htm", "shtml", "xhtml"
}

SUSPICIOUS_EXTENSIONS = {
    "zip", "rar", "7z", "tar", "gz", "bz2", "xz", "iso", "img",
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "rtf",
    "eml", "msg", "vcf", "ics", "xml", "json", "csv", "sql"
}


def decode_mime_header(header_value: str) -> str:
    """Decode MIME-encoded header values."""
    if not header_value:
        return ""
    try:
        decoded_parts = email.header.decode_header(header_value)
        result = []
        for part, encoding in decoded_parts:
            if isinstance(part, bytes):
                result.append(part.decode(encoding or "utf-8", errors="replace"))
            else:
                result.append(part)
        return " ".join(result)
    except Exception:
        return header_value


def extract_email_addresses(header_value: str) -> list[str]:
    """Extract email addresses from a header value."""
    if not header_value:
        return []
    # Simple email extraction
    pattern = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
    return list(dict.fromkeys(pattern.findall(header_value)))


def parse_email_address(addr: str) -> tuple[str, str]:
    """Parse an email address into display name and address."""
    name, address = email.utils.parseaddr(addr)
    return decode_mime_header(name), address.lower()


def get_email_body(msg: email.message.EmailMessage) -> tuple[str, str]:
    """Extract plain text and HTML body from email."""
    text_body = ""
    html_body = ""

    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition", ""))

            # Skip attachments
            if "attachment" in content_disposition:
                continue

            payload = part.get_payload(decode=True)
            if payload is None:
                continue

            charset = part.get_content_charset() or "utf-8"
            try:
                decoded = payload.decode(charset, errors="replace")
            except Exception:
                decoded = payload.decode("utf-8", errors="replace")

            if content_type == "text/plain":
                text_body += decoded + "\n"
            elif content_type == "text/html":
                html_body += decoded + "\n"
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset() or "utf-8"
            try:
                decoded = payload.decode(charset, errors="replace")
            except Exception:
                decoded = payload.decode("utf-8", errors="replace")

            if msg.get_content_type() == "text/html":
                html_body = decoded
            else:
                text_body = decoded

    return text_body.strip(), html_body.strip()


def extract_urls_from_text(text: str) -> list[str]:
    """Extract URLs from text content."""
    # Enhanced URL pattern
    url_pattern = re.compile(
        r"(?i)(?<![@\w])(?:https?://|www\.)[^\s<>\"'\)\]]+|(?<![@\w])\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)+(?:/[^\s<>\"'\)\]]*)?"
    )
    urls = []
    for match in url_pattern.finditer(text):
        url = match.group(0).rstrip(".,!?;:)]}>")
        if url and url not in urls:
            urls.append(url)
    return urls


def extract_urls_from_html(html: str) -> list[str]:
    """Extract URLs from HTML content (href, src attributes)."""
    urls = []
    # href attributes
    href_pattern = re.compile(r'href\s*=\s*["\']([^"\']+)["\']', re.I)
    for match in href_pattern.finditer(html):
        url = match.group(1).strip()
        if url.startswith(("http://", "https://", "www.")):
            urls.append(url)
    # src attributes
    src_pattern = re.compile(r'src\s*=\s*["\']([^"\']+)["\']', re.I)
    for match in src_pattern.finditer(html):
        url = match.group(1).strip()
        if url.startswith(("http://", "https://", "www.")):
            urls.append(url)
    return list(dict.fromkeys(urls))


def analyze_sender(sender_header: str, from_header: str, reply_to_header: str) -> dict:
    """Analyze sender information for spoofing indicators."""
    result = {
        "display_name": "",
        "sender_address": "",
        "from_address": "",
        "reply_to_address": "",
        "mismatch": False,
        "suspicious": False,
        "details": [],
        "domains": {}
    }

    # Parse sender (envelope sender)
    sender_name, sender_addr = parse_email_address(sender_header)
    result["sender_address"] = sender_addr

    # Parse From header
    from_name, from_addr = parse_email_address(from_header)
    result["from_address"] = from_addr
    result["display_name"] = from_name

    # Parse Reply-To header
    reply_name, reply_addr = parse_email_address(reply_to_header)
    result["reply_to_address"] = reply_addr
    result["domains"] = {
        "from": from_addr.rsplit("@", 1)[-1].lower().rstrip(".") if "@" in from_addr else None,
        "envelope_sender": sender_addr.rsplit("@", 1)[-1].lower().rstrip(".") if "@" in sender_addr else None,
        "reply_to": reply_addr.rsplit("@", 1)[-1].lower().rstrip(".") if "@" in reply_addr else None,
    }
    from_domain = result["domains"]["from"]
    if from_domain:
        result["domains"]["from_domain_is_public_mail"] = from_domain in {
            "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com",
            "icloud.com", "protonmail.com", "proton.me"
        }

    # Check for display name / address mismatch
    if from_name and from_addr:
        from_domain = from_addr.split("@")[-1] if "@" in from_addr else ""
        # Check if display name contains a domain different from actual domain
        domain_in_name = re.search(r"@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})", from_name)
        if domain_in_name and domain_in_name.group(1).lower() != from_domain.lower():
            result["mismatch"] = True
            result["details"].append("Display name contains different domain than sender address")

    # Check From vs Reply-To mismatch
    if from_addr and reply_addr and from_addr != reply_addr:
        result["mismatch"] = True
        result["details"].append("Reply-To address differs from From address")

    # Check Sender vs From mismatch (envelope vs header)
    if sender_addr and from_addr and sender_addr != from_addr:
        result["mismatch"] = True
        result["details"].append("Envelope sender differs from From header")

    # Check for suspicious patterns
    if from_addr:
        local_part = from_addr.split("@")[0]
        domain = from_addr.split("@")[-1]

        # Random-looking local part
        if re.match(r"^[a-z0-9]{20,}@|^[a-f0-9]{32}@", from_addr):
            result["suspicious"] = True
            result["details"].append("Random-looking sender address")

        # Free email providers used for business
        free_providers = {"gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com", "icloud.com", "protonmail.com"}
        if domain in free_providers and from_name and any(b in from_name.lower() for b in TARGET_BRANDS):
            result["suspicious"] = True
            result["details"].append(f"Business brand name used with free email provider ({domain})")

        # Suspicious TLD
        tld = domain.split(".")[-1].lower()
        if tld in SUSPICIOUS_TLDS:
            result["suspicious"] = True
            result["details"].append(f"Suspicious TLD: .{tld}")

        # Subdomain spoofing (e.g., security.paypal.com.phisher.com)
        for brand in TARGET_BRANDS:
            if brand in domain and not domain.endswith(f".{brand}.com") and not domain == f"{brand}.com":
                result["suspicious"] = True
                result["details"].append(f"Possible {brand} impersonation via subdomain")
                break

    return result


def analyze_authentication_headers(msg: email.message.EmailMessage) -> dict:
    """Analyze email authentication headers (SPF, DKIM, DMARC)."""
    result = {
        "spf": "NONE",
        "dkim": "NONE",
        "dmarc": "NONE",
        "evidence_present": {"spf": False, "dkim": False, "dmarc": False},
        "sources": {"spf": [], "dkim": [], "dmarc": []},
        "details": []
    }

    # Check Received-SPF header
    spf_header = msg.get("Received-SPF", "")
    if spf_header:
        spf_match = re.search(r"\b(pass|fail|softfail|neutral|none|temperror|permerror)\b", spf_header, re.I)
        if spf_match:
            result["spf"] = spf_match.group(1).upper()
            result["evidence_present"]["spf"] = True
            result["sources"]["spf"].append("Received-SPF")
            result["details"].append(f"SPF: {result['spf']} ({spf_header[:100]})")

    # Check Authentication-Results header (most comprehensive)
    auth_results_values = msg.get_all("Authentication-Results", [])
    for auth_results in auth_results_values:
        # SPF
        spf_match = re.search(r"spf=(\w+)", auth_results, re.I)
        if spf_match:
            result["spf"] = spf_match.group(1).upper()
            result["evidence_present"]["spf"] = True
            result["sources"]["spf"].append("Authentication-Results")

        # DKIM
        dkim_match = re.search(r"dkim=(\w+)", auth_results, re.I)
        if dkim_match:
            result["dkim"] = dkim_match.group(1).upper()
            result["evidence_present"]["dkim"] = True
            result["sources"]["dkim"].append("Authentication-Results")

        # DMARC
        dmarc_match = re.search(r"dmarc=(\w+)", auth_results, re.I)
        if dmarc_match:
            result["dmarc"] = dmarc_match.group(1).upper()
            result["evidence_present"]["dmarc"] = True
            result["sources"]["dmarc"].append("Authentication-Results")

        result["details"].append(f"Authentication-Results: {auth_results[:200]}")

    # Check DKIM-Signature header presence
    if msg.get("DKIM-Signature"):
        if result["dkim"] == "NONE":
            result["dkim"] = "PRESENT"
        result["evidence_present"]["dkim"] = True
        result["sources"]["dkim"].append("DKIM-Signature (signature present; verification result unavailable)")
        result["details"].append("DKIM-Signature header present")

    # Check for ARC (Authenticated Received Chain)
    arc_headers = [h for h in msg.keys() if h.lower().startswith("arc-")]
    if arc_headers:
        result["details"].append(f"ARC headers present: {', '.join(arc_headers)}")

    return result


def analyze_attachments(msg: email.message.EmailMessage) -> list[dict]:
    """Extract and analyze email attachments."""
    attachments = []

    if msg.is_multipart():
        for part in msg.walk():
            content_disposition = str(part.get("Content-Disposition", ""))
            if "attachment" not in content_disposition:
                continue

            filename = part.get_filename()
            if filename:
                filename = decode_mime_header(filename)

            content_type = part.get_content_type()
            payload = part.get_payload(decode=True)
            size = len(payload) if payload else 0

            # Determine extension
            ext = ""
            if filename:
                ext = filename.split(".")[-1].lower() if "." in filename else ""

            # Assess risk
            risk_level = "LOW"
            risk_reasons = []

            if ext in DANGEROUS_EXTENSIONS:
                risk_level = "HIGH"
                risk_reasons.append(f"Dangerous file extension: .{ext}")
            elif ext in SUSPICIOUS_EXTENSIONS:
                risk_level = "MEDIUM"
                risk_reasons.append(f"Potentially suspicious extension: .{ext}")

            if size > 10 * 1024 * 1024:  # > 10MB
                risk_level = "MEDIUM" if risk_level == "LOW" else risk_level
                risk_reasons.append(f"Large attachment: {size / (1024*1024):.1f} MB")

            # Check for double extensions
            if filename and len(filename.split(".")) > 2:
                parts = filename.split(".")
                if parts[-2].lower() in {"pdf", "doc", "xls", "ppt", "txt", "jpg", "png"} and parts[-1].lower() in DANGEROUS_EXTENSIONS:
                    risk_level = "HIGH"
                    risk_reasons.append(f"Double extension detected: {parts[-2]}.{parts[-1]}")

            attachments.append({
                "filename": filename or "unknown",
                "content_type": content_type,
                "size": size,
                "extension": ext,
                "risk_level": risk_level,
                "risk_reasons": risk_reasons,
                "scanned": False,
                "scan_note": "Attachment not scanned for malware - no scanning integration available"
            })

    return attachments


def analyze_urls_in_email(urls: list[str]) -> list[dict]:
    """Analyze URLs found in email using existing URL detection."""
    results = []
    unique_urls = list(dict.fromkeys(urls))[:MAX_URLS_TO_ANALYZE]

    for url in unique_urls:
        try:
            normalized = normalize_url(url)
        except Exception:
            results.append({
                "url": url,
                "normalized": None,
                "error": "Invalid URL format",
                "risk_classification": "UNKNOWN",
                "findings": []
            })
            continue

        try:
            # Use existing investigation function
            report = investigate(normalized)
            findings_summary = []
            for finding in report.get("findings", []):
                findings_summary.append({
                    "category": finding["category"],
                    "severity": finding["severity"],
                    "description": finding["description"]
                })

            results.append({
                "url": url,
                "normalized": normalized,
                "risk_classification": report["risk_classification"],
                "risk_score": calculate_url_risk_score(report),
                "findings": findings_summary,
                "redirect_chain": [hop["url"] for hop in report.get("redirect_chain", [])],
                "final_url": report.get("final_url", normalized)
            })
        except Exception as e:
            results.append({
                "url": url,
                "normalized": normalized,
                "error": str(e),
                "risk_classification": "ERROR",
                "findings": []
            })

    return results


def analyze_urls_offline(urls: list[str]) -> list[dict]:
    """Assess URLs from their text alone, without any network request."""
    results = []
    weights = {"strong": 40, "moderate": 15, "weak": 3}
    for url in list(dict.fromkeys(urls))[:MAX_URLS_TO_ANALYZE]:
        try:
            normalized = normalize_url(url)
            indicators = analyze_url(normalized)["indicators"]
        except Exception:
            results.append({"url": url, "normalized": None, "error": "Invalid URL format",
                            "risk_classification": "UNKNOWN", "findings": []})
            continue
        significant = any(item["strength"] in ("moderate", "strong") for item in indicators)
        results.append({
            "url": url, "normalized": normalized,
            "risk_classification": "Suspicious" if significant else "Not checked online",
            "risk_score": min(100, sum(weights.get(item["strength"], 0) for item in indicators)),
            "findings": [{"category": "url", "severity": "high" if item["strength"] == "strong" else "medium" if item["strength"] == "moderate" else "low",
                          "description": item["description"]} for item in indicators],
            "redirect_chain": [], "final_url": normalized,
        })
    return results


def calculate_url_risk_score(report: dict) -> int:
    """Calculate a numeric risk score from URL investigation report."""
    score = 0
    severity_weights = {"critical": 40, "high": 25, "medium": 15, "low": 5, "info": 2}

    for finding in report.get("findings", []):
        score += severity_weights.get(finding["severity"], 0)

    # Add points for redirect chain length
    redirect_count = len(report.get("redirect_chain", []))
    if redirect_count > 2:
        score += min(20, redirect_count * 3)

    # Add points for HTTP (non-HTTPS)
    final_url = report.get("final_url", "")
    if final_url.startswith("http://"):
        score += 15

    return min(100, score)


def analyze_email_content(text_body: str, html_body: str) -> dict:
    """Analyze email content using NLP indicators."""
    combined_text = f"{text_body}\n{html_body}"
    combined_text = re.sub(r"<[^>]+>", " ", combined_text)  # Strip HTML tags
    combined_text = " ".join(combined_text.split())  # Normalize whitespace

    matched_indicators = []
    for code, pattern, title in EMAIL_INDICATORS:
        matches = list(dict.fromkeys(match.group(0) for match in pattern.finditer(combined_text)))
        if matches:
            matched_indicators.append({
                "code": code,
                "name": title,
                "evidence": matches[:5],  # Limit evidence examples
                "count": len(matches)
            })

    return {
        "text_length": len(text_body),
        "html_length": len(html_body),
        "indicators": matched_indicators,
        "indicator_count": len(matched_indicators)
    }


def calculate_risk_score(
    sender_analysis: dict,
    auth_analysis: dict,
    content_analysis: dict,
    url_analysis: list[dict],
    attachments: list[dict]
) -> tuple[int, Literal["SAFE", "SUSPICIOUS", "PHISHING", "SCAM"]]:
    """Calculate overall risk score and classification."""
    score = 0
    reasons = []

    # Sender analysis scoring
    if sender_analysis.get("mismatch"):
        score += 20
        reasons.append("Sender/From/Reply-To address mismatch")
    if sender_analysis.get("suspicious"):
        score += 15
        for detail in sender_analysis.get("details", []):
            reasons.append(f"Suspicious sender: {detail}")

    # Authentication scoring
    auth_failures = 0
    if auth_analysis.get("spf") in {"FAIL", "SOFTFAIL"}:
        score += 15
        auth_failures += 1
        reasons.append(f"SPF {auth_analysis['spf']}")
    if auth_analysis.get("dkim") == "FAIL":
        score += 10
        auth_failures += 1
        reasons.append(f"DKIM {auth_analysis['dkim']}")
    if auth_analysis.get("dmarc") == "FAIL":
        score += 15
        auth_failures += 1
        reasons.append(f"DMARC {auth_analysis['dmarc']}")

    # All three failed = strong indicator
    if auth_failures >= 3:
        score += 10
        reasons.append("Complete authentication failure (SPF, DKIM, DMARC)")

    # Content analysis scoring
    high_severity_indicators = {"credential_harvesting", "otp_theft", "banking_kyc", "payment_request"}
    medium_severity_indicators = {"urgency_pressure", "threat_intimidation", "impersonation", "fake_invoice",
                                   "lottery_prize", "job_offer", "package_delivery", "account_compromise"}

    for indicator in content_analysis.get("indicators", []):
        if indicator["code"] in high_severity_indicators:
            score += 18
            reasons.append(f"High-risk content: {indicator['name']}")
        elif indicator["code"] in medium_severity_indicators:
            score += 12
            reasons.append(f"Medium-risk content: {indicator['name']}")
        else:
            score += 6
            reasons.append(f"Content indicator: {indicator['name']}")

    # URL analysis scoring
    max_url_risk = 0
    malicious_urls = 0
    for url_result in url_analysis:
        url_score = url_result.get("risk_score", 0)
        max_url_risk = max(max_url_risk, url_score)
        if url_result.get("risk_classification") in {"Confirmed Malicious", "Suspicious"}:
            malicious_urls += 1

    if malicious_urls > 0:
        score += min(30, max_url_risk + malicious_urls * 5)
        reasons.append(f"Suspicious URLs detected ({malicious_urls})")

    # Attachment scoring
    for att in attachments:
        if att["risk_level"] == "HIGH":
            score += 15
            reasons.append(f"High-risk attachment: {att['filename']}")
        elif att["risk_level"] == "MEDIUM":
            score += 8
            reasons.append(f"Suspicious attachment: {att['filename']}")

    score = min(100, score)

    # Classification
    if score >= 70:
        classification = "PHISHING"
    elif score >= 45:
        classification = "SCAM"
    elif score >= 20:
        classification = "SUSPICIOUS"
    else:
        classification = "SAFE"

    return score, classification


def generate_recommendations(classification: str, reasons: list[str], url_analysis: list[dict], attachments: list[dict]) -> list[str]:
    """Generate actionable recommendations based on analysis."""
    recs = []

    if classification in {"PHISHING", "SCAM"}:
        recs.append("Do not click any links in this email")
        recs.append("Do not reply to this email")
        recs.append("Do not provide any passwords, OTPs, or personal information")
        recs.append("Report this email to your IT/security team")

        if any("credential" in r.lower() for r in reasons):
            recs.append("If you entered credentials, change them immediately on the legitimate website")
        if any("otp" in r.lower() for r in reasons):
            recs.append("Never share OTPs or verification codes with anyone")

    elif classification == "SUSPICIOUS":
        recs.append("Exercise caution with this email")
        recs.append("Verify the sender through an independent channel (official website, phone number)")
        recs.append("Do not click links until verified")
        recs.append("Hover over links to check actual destination before clicking")

    else:  # SAFE
        recs.append("No strong indicators of phishing or scam detected")
        recs.append("Still verify unexpected requests independently")
        recs.append("Report if you have any doubts about the email's legitimacy")

    # URL-specific recommendations
    malicious_urls = [u for u in url_analysis if u.get("risk_classification") in {"Confirmed Malicious", "Suspicious"}]
    if malicious_urls:
        recs.append(f"Analyzed URLs flagged as suspicious - do not visit: {', '.join(u['url'] for u in malicious_urls[:3])}")

    # Attachment recommendations
    high_risk_atts = [a for a in attachments if a["risk_level"] == "HIGH"]
    if high_risk_atts:
        recs.append(f"High-risk attachments detected - do not open: {', '.join(a['filename'] for a in high_risk_atts)}")

    return recs


def parse_eml_file(eml_content: bytes) -> email.message.EmailMessage:
    """Parse an .eml file into an email message object."""
    try:
        return email.message_from_bytes(eml_content, policy=email.policy.default)
    except Exception as e:
        raise ValueError(f"Failed to parse .eml file: {e}")


def parse_email_text(email_text: str) -> email.message.EmailMessage:
    """Parse raw email text into an email message object."""
    try:
        return email.message_from_string(email_text, policy=email.policy.default)
    except Exception as e:
        raise ValueError(f"Failed to parse email text: {e}")


def analyze_email(
    email_input: str | bytes,
    input_type: Literal["text", "eml"],
    use_gemini: bool = False,
    follow_links: bool = True
) -> dict:
    """
    Main email analysis function.

    Args:
        email_input: Raw email text or .eml file bytes
        input_type: "text" for pasted email, "eml" for .eml file
        use_gemini: Whether to use Gemini for AI explanation

    Returns:
        Structured analysis report
    """
    # Enforce limits before MIME parsing to avoid unnecessary memory/CPU work.
    raw_size = len(email_input) if isinstance(email_input, bytes) else len(email_input.encode("utf-8"))
    if raw_size > MAX_EMAIL_SIZE:
        raise ValueError(f"Email exceeds maximum size of {MAX_EMAIL_SIZE} bytes")
    if raw_size == 0:
        raise ValueError("Email cannot be empty")

    # Parse email
    if input_type == "eml":
        if isinstance(email_input, str):
            email_input = email_input.encode("utf-8")
        msg = parse_eml_file(email_input)
    else:
        if isinstance(email_input, bytes):
            email_input = email_input.decode("utf-8", errors="replace")
        msg = parse_email_text(email_input)

    # Extract headers
    sender = msg.get("Sender", "") or msg.get("Return-Path", "") or msg.get("X-Sender", "")
    from_header = msg.get("From", "")
    reply_to = msg.get("Reply-To", "")
    subject = decode_mime_header(msg.get("Subject", ""))
    date_header = msg.get("Date", "")
    message_id = msg.get("Message-ID", "")

    # Extract body
    text_body, html_body = get_email_body(msg)

    # Extract all URLs
    urls = []
    urls.extend(extract_urls_from_text(text_body))
    urls.extend(extract_urls_from_text(html_body))
    urls.extend(extract_urls_from_html(html_body))
    urls = list(dict.fromkeys(urls))  # Deduplicate

    # Run analysis layers
    sender_analysis = analyze_sender(sender, from_header, reply_to)
    auth_analysis = analyze_authentication_headers(msg)
    content_analysis = analyze_email_content(text_body, html_body)
    url_analysis = analyze_urls_in_email(urls) if follow_links else analyze_urls_offline(urls)
    attachments = analyze_attachments(msg)

    # Calculate risk score and classification
    risk_score, classification = calculate_risk_score(
        sender_analysis, auth_analysis, content_analysis, url_analysis, attachments
    )

    # Collect all reasons for recommendations
    all_reasons = []
    if sender_analysis.get("mismatch"):
        all_reasons.append("Sender/From/Reply-To address mismatch")
    if sender_analysis.get("suspicious"):
        all_reasons.extend(sender_analysis.get("details", []))
    if auth_analysis.get("spf") in {"FAIL", "SOFTFAIL"}:
        all_reasons.append(f"SPF {auth_analysis['spf']}")
    if auth_analysis.get("dkim") == "FAIL":
        all_reasons.append(f"DKIM {auth_analysis['dkim']}")
    if auth_analysis.get("dmarc") == "FAIL":
        all_reasons.append(f"DMARC {auth_analysis['dmarc']}")
    for indicator in content_analysis.get("indicators", []):
        all_reasons.append(indicator["name"])
    for url_result in url_analysis:
        if url_result.get("risk_classification") in {"Confirmed Malicious", "Suspicious"}:
            all_reasons.append(f"Suspicious URL: {url_result['url']}")
    for att in attachments:
        if att["risk_level"] in {"HIGH", "MEDIUM"}:
            all_reasons.extend(att["risk_reasons"])

    recommendations = generate_recommendations(classification, all_reasons, url_analysis, attachments)

    # Build indicators list for output
    indicators = []

    # Sender indicators
    if sender_analysis.get("mismatch"):
        indicators.append({
            "type": "SENDER_MISMATCH",
            "severity": "HIGH",
            "evidence": "Email sender, From, and/or Reply-To addresses do not match"
        })
    if sender_analysis.get("suspicious"):
        for detail in sender_analysis.get("details", []):
            indicators.append({
                "type": "SUSPICIOUS_SENDER",
                "severity": "MEDIUM",
                "evidence": detail
            })

    # Authentication indicators
    for auth_type in ["spf", "dkim", "dmarc"]:
        value = auth_analysis.get(auth_type, "NONE")
        if value in {"FAIL", "SOFTFAIL"}:
            indicators.append({
                "type": f"{auth_type.upper()}_FAILURE",
                "severity": "HIGH" if auth_type == "dmarc" else "MEDIUM",
                "evidence": f"{auth_type.upper()} authentication {value}"
            })
        elif value == "NONE":
            if not auth_analysis.get("evidence_present", {}).get(auth_type, False):
                indicators.append({
                    "type": f"{auth_type.upper()}_MISSING",
                    "severity": "INFO",
                    "evidence": f"No {auth_type.upper()} result was provided in the submitted headers; this is missing evidence, not a verified failure"
                })

    # Content indicators
    for indicator in content_analysis.get("indicators", []):
        severity = "HIGH" if indicator["code"] in high_severity_indicators else "MEDIUM" if indicator["code"] in medium_severity_indicators else "LOW"
        indicators.append({
            "type": indicator["code"].upper(),
            "severity": severity,
            "evidence": f"Found {indicator['count']} occurrence(s): {', '.join(indicator['evidence'][:3])}"
        })

    # URL indicators
    for url_result in url_analysis:
        if url_result.get("risk_classification") == "Confirmed Malicious":
            indicators.append({
                "type": "MALICIOUS_URL",
                "severity": "CRITICAL",
                "evidence": f"URL '{url_result['url']}' matched known threat intelligence"
            })
        elif url_result.get("risk_classification") == "Suspicious":
            indicators.append({
                "type": "SUSPICIOUS_URL",
                "severity": "HIGH",
                "evidence": f"URL '{url_result['url']}' flagged as suspicious (score: {url_result.get('risk_score', 0)})"
            })

    # Attachment indicators
    for att in attachments:
        if att["risk_level"] == "HIGH":
            indicators.append({
                "type": "DANGEROUS_ATTACHMENT",
                "severity": "HIGH",
                "evidence": f"Attachment '{att['filename']}': {', '.join(att['risk_reasons'])}"
            })
        elif att["risk_level"] == "MEDIUM":
            indicators.append({
                "type": "SUSPICIOUS_ATTACHMENT",
                "severity": "MEDIUM",
                "evidence": f"Attachment '{att['filename']}': {', '.join(att['risk_reasons'])}"
            })

    # Build report
    report = {
        "id": str(uuid4()),
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
        "classification": classification,
        "risk_score": risk_score,
        "risk_scoring": {
            "method": "Deterministic weighted indicators; score is capped at 100",
            "thresholds": {"safe": "0-19", "suspicious": "20-44", "scam": "45-69", "phishing": "70-100"},
            "weights": {
                "sender_mismatch": 20, "suspicious_sender": 15,
                "spf_fail_or_softfail": 15, "dkim_fail": 10, "dmarc_fail": 15,
                "all_three_auth_failures_bonus": 10,
                "high_risk_content_indicator": 18, "medium_risk_content_indicator": 12,
                "other_content_indicator": 6,
                "suspicious_url": "up to 30 based on the strongest URL score and number of flagged URLs",
                "high_risk_attachment": 15, "medium_risk_attachment": 8,
                "missing_authentication_evidence": 0
            }
        },
        "sender": from_header,
        "subject": subject,
        "date": date_header,
        "message_id": message_id,
        "indicators": indicators,
        "authentication": {
            "spf": auth_analysis.get("spf", "NONE"),
            "dkim": auth_analysis.get("dkim", "NONE"),
            "dmarc": auth_analysis.get("dmarc", "NONE"),
            "evidence_present": auth_analysis.get("evidence_present", {}),
            "sources": auth_analysis.get("sources", {}),
            "details": auth_analysis.get("details", [])
        },
        "urls": url_analysis,
        "attachments": attachments,
        "content_analysis": {
            "text_length": content_analysis["text_length"],
            "html_length": content_analysis["html_length"],
            "indicator_count": content_analysis["indicator_count"],
            "matched_indicators": content_analysis["indicators"]
        },
        "sender_analysis": sender_analysis,
        "recommendations": recommendations,
        "limitations": [
            "Email analysis is based on static content; runtime behavior is not observed",
            "Attachment malware scanning is not performed - attachments are only assessed by metadata",
            "URL reputation checks depend on external threat intelligence availability",
            "Authentication results depend on headers present in the email; missing headers may indicate relay issues",
            "Classification is heuristic-based and may produce false positives or false negatives"
        ]
    }

    # Add AI explanation if requested
    if use_gemini:
        # Create a summary for Gemini that doesn't include full email content
        try:
            ai_explanation = explain_email_analysis(report)
            report["ai_explanation"] = ai_explanation
        except Exception as e:
            report["ai_explanation"] = {
                "status": "unavailable",
                "error": str(e),
                "provider": "Gemini"
            }
    else:
        # Local explanation
        report["ai_explanation"] = generate_local_explanation(report)

    return report


def generate_local_explanation(report: dict) -> dict:
    """Generate a local rule-based explanation."""
    from datetime import datetime, timezone

    classification = report["classification"]
    risk_score = report["risk_score"]

    verdicts = {
        "SAFE": "No significant threat indicators detected. This does not guarantee the email is legitimate.",
        "SUSPICIOUS": "One or more suspicious indicators found. Verify the email independently before taking action.",
        "SCAM": "Multiple scam indicators detected. This email likely attempts fraud or deception.",
        "PHISHING": "Strong phishing indicators detected. This email likely attempts credential theft or impersonation."
    }

    insights = []
    actions = []

    # Summary
    summary_text = verdicts.get(classification, "Assessment unclear.")
    insights.append({"text": summary_text, "evidence_ids": ["assessment"]})

    # Explain key findings
    for indicator in report["indicators"][:8]:  # Top 8 indicators
        insight_text = f"{indicator['type'].replace('_', ' ').title()}: {indicator['evidence']}"
        insights.append({"text": insight_text, "evidence_ids": [indicator["type"].lower()]})

    # Authentication summary
    auth = report["authentication"]
    if any(v in {"FAIL", "SOFTFAIL"} for v in [auth["spf"], auth["dkim"], auth["dmarc"]]):
        auth_issues = []
        if auth["spf"] in {"FAIL", "SOFTFAIL", "NONE"}:
            if auth["spf"] in {"FAIL", "SOFTFAIL"}:
                auth_issues.append(f"SPF: {auth['spf']}")
        if auth["dkim"] == "FAIL":
            auth_issues.append(f"DKIM: {auth['dkim']}")
        if auth["dmarc"] == "FAIL":
            auth_issues.append(f"DMARC: {auth['dmarc']}")
        insights.append({
            "text": f"Email authentication issues: {', '.join(auth_issues)}. Failed authentication enables sender spoofing.",
            "evidence_ids": ["authentication"]
        })

    # URL summary
    if report["urls"]:
        suspicious_urls = [u for u in report["urls"] if u.get("risk_classification") in {"Confirmed Malicious", "Suspicious"}]
        if suspicious_urls:
            insights.append({
                "text": f"{len(suspicious_urls)} of {len(report['urls'])} extracted URLs flagged as suspicious or malicious. These links may lead to phishing sites or malware.",
                "evidence_ids": ["urls"]
            })
        else:
            insights.append({
                "text": f"{len(report['urls'])} URL(s) extracted and analyzed. No known threats detected, but verify independently before clicking.",
                "evidence_ids": ["urls"]
            })

    # Attachment summary
    if report["attachments"]:
        high_risk = [a for a in report["attachments"] if a["risk_level"] == "HIGH"]
        med_risk = [a for a in report["attachments"] if a["risk_level"] == "MEDIUM"]
        if high_risk:
            insights.append({
                "text": f"{len(high_risk)} high-risk attachment(s) detected. Do not open without malware scanning.",
                "evidence_ids": ["attachments"]
            })
        elif med_risk:
            insights.append({
                "text": f"{len(med_risk)} potentially suspicious attachment(s). Exercise caution and scan before opening.",
                "evidence_ids": ["attachments"]
            })
        else:
            insights.append({
                "text": f"{len(report['attachments'])} attachment(s) analyzed. No obvious risk indicators in metadata.",
                "evidence_ids": ["attachments"]
            })

    # Actions
    for rec in report["recommendations"][:5]:
        actions.append({"text": rec, "evidence_ids": ["assessment"]})

    if not actions:
        actions.append({"text": "Verify unexpected requests through independent channels.", "evidence_ids": ["assessment"]})

    return {
        "status": "completed",
        "provider": "Local rules",
        "model": "Rule-based explanation",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "summary": {"text": summary_text, "evidence_ids": ["assessment"]},
        "explanations": insights,
        "next_steps": actions,
        "evidence": [{"id": "assessment", "classification": classification, "risk_score": risk_score}]
    }


# High/medium severity indicator sets for scoring
high_severity_indicators = {"credential_harvesting", "otp_theft", "banking_kyc", "payment_request"}
medium_severity_indicators = {"urgency_pressure", "threat_intimidation", "impersonation", "fake_invoice"}
