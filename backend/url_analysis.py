"""Offline URL indicators; heuristic evidence, not proof of fraud."""

import ipaddress
import re
from urllib.parse import parse_qsl, unquote, urlsplit

import idna
import tldextract
from confusable_homoglyphs import confusables

from backend.network import UnsafeURL, normalize_url

# Small, intentionally bounded registry; this is not a comprehensive ownership database.
BRANDS = {
    "paypal": ("paypal.com",),
    "google": ("google.com", "google.co.in", "google.co.uk", "googleusercontent.com"),
    "microsoft": ("microsoft.com", "microsoftonline.com", "live.com", "office.com", "outlook.com"),
    "amazon": ("amazon.com", "amazon.in", "amazon.co.uk"),
    "apple": ("apple.com", "icloud.com"),
    "github": ("github.com",),
    "netflix": ("netflix.com",),
    "facebook": ("facebook.com", "fb.com"),
    "instagram": ("instagram.com",),
    "whatsapp": ("whatsapp.com", "whatsapp.net"),
    "linkedin": ("linkedin.com",),
    "sbi": ("sbi", "sbi.co.in", "onlinesbi.com", "sbicard.com", "sbilife.co.in"),
    "hdfc": ("hdfc.com", "hdfcbank.com", "hdfclife.com", "hdfcergo.com"),
    "icici": ("icicibank.com", "icicidirect.com", "iciciprulife.com", "icicilombard.com"),
    "axisbank": ("axisbank.com",),
    "kotak": ("kotak.com",),
    "paytm": ("paytm.com", "paytm.in", "paytmbank.com"),
    "phonepe": ("phonepe.com",),
    "flipkart": ("flipkart.com",),
    "irctc": ("irctc.co.in",),
    "uidai": ("uidai.gov.in",),
}
# Ordinary words one edit away from a brand name are not misspellings of it.
NOT_BRAND_TYPOS = {"apply", "maple", "ample"}
MIN_TYPO_BRAND_LENGTH = 5
EXTRACT = tldextract.TLDExtract(suffix_list_urls=(), cache_dir=None, include_psl_private_domains=True)
LURES = {"login", "signin", "verify", "verification", "password", "account", "secure", "wallet", "kyc"}
REDIRECT_PARAMETERS = {"url", "redirect", "redirect_uri", "redirect_url", "next", "continue", "return", "return_url", "destination", "dest"}


def domain_info(host: str) -> dict:
    try:
        ipaddress.ip_address(host)
        return {"hostname": host, "unicode_hostname": host, "registrable_domain": None,
                "suffix": None, "subdomain": "", "domain_label": host, "is_ip": True}
    except ValueError:
        pass
    parts = EXTRACT(host)
    return {"hostname": host, "unicode_hostname": idna.decode(host),
            "registrable_domain": parts.top_domain_under_public_suffix or None,
            "suffix": parts.suffix or None, "subdomain": parts.subdomain,
            "domain_label": parts.domain, "is_private_suffix": parts.is_private, "is_ip": False}


def near_match(left: str, right: str) -> bool:
    """One edit or adjacent transposition, only for small brand-length labels."""
    if left == right or abs(len(left) - len(right)) > 1:
        return False
    if len(left) == len(right):
        differences = [i for i, (a, b) in enumerate(zip(left, right)) if a != b]
        return len(differences) == 1 or (len(differences) == 2 and differences[1] == differences[0] + 1
                and left[differences[0]] == right[differences[1]] and left[differences[1]] == right[differences[0]])
    shorter, longer = sorted((left, right), key=len)
    return any(longer[:i] + longer[i + 1:] == shorter for i in range(len(longer)))


def looks_like(label: str, brand: str) -> bool:
    if len(label) != len(brand):
        return False
    for character, target in zip(label, brand):
        if character == target:
            continue
        if character.isascii():
            return False
        if not any(item["c"] == target for item in confusables.confusables_data.get(character, [])):
            return False
    return label != brand


def analyze_url(url: str) -> dict:
    parts = urlsplit(url)
    info = domain_info(parts.hostname)
    indicators = []

    def add(code, description, evidence, strength="weak", group="hostname_identity"):
        indicators.append({"code": code, "description": description, "evidence": evidence,
                           "strength": strength, "signal_group": group})

    host = info["hostname"]
    if info["is_ip"]:
        add("ip_hostname", "URL uses an IP address rather than a domain", {"hostname": host})
    else:
        unicode_labels = info["unicode_hostname"].split(".")
        if "xn--" in host:
            add("internationalized_hostname", "Internationalized hostname requires careful identity review", info)
        mixed = [label for label in unicode_labels if confusables.is_mixed_script(label)]
        if mixed:
            add("mixed_script", "Hostname label combines writing systems", {"labels": mixed})
        if host.count("-") >= 4 or len(info["subdomain"].split(".")) >= 5:
            add("unusual_structure", "Unusual hostname structure", {"hostname": host})
        tokens = set(re.findall(r"[a-z0-9]+", unquote(parts.path).lower())) | set(re.findall(r"[a-z0-9]+", host))
        lure_context = sorted(tokens & LURES)
        label = idna.decode(info["domain_label"]) if info["domain_label"] else ""
        subdomain_labels = info["subdomain"].split(".")
        for brand, roots in BRANDS.items():
            if any(host == root or host.endswith("." + root) for root in roots):
                continue
            deceptive = next((root for root in roots if f".{root}." in f".{host}."), None)
            evidence = {"brand": brand, "observed_hostname": host, "registrable_domain": info["registrable_domain"],
                        "known_domains": list(roots), "credential_context": lure_context,
                        "registry_scope": "Curated examples; not exhaustive ownership verification"}
            if deceptive:
                add("deceptive_subdomain", "Known brand domain appears inside an unrelated hostname", {**evidence, "embedded_brand_domain": deceptive}, "strong")
            elif any(looks_like(candidate, brand) for candidate in unicode_labels):
                add("brand_homoglyph", "Unicode hostname resembles a protected brand", evidence, "strong")
            elif brand in re.split(r"[-_]", label) or brand in subdomain_labels:
                add("brand_in_unrelated_hostname", "Brand name appears on an unverified domain", evidence, "moderate" if lure_context else "weak")
            elif len(brand) >= MIN_TYPO_BRAND_LENGTH and any(
                    near_match(token, brand) and token not in NOT_BRAND_TYPOS for token in re.split(r"[-_]", label)):
                add("brand_typo", "Domain label is a close spelling of a protected brand", {**evidence, "observed_label": label}, "moderate" if lure_context else "weak")

    for name, value in parse_qsl(parts.query, keep_blank_values=True)[:32]:
        if name.lower() not in REDIRECT_PARAMETERS:
            continue
        value = unquote(value).strip()
        if not (value.startswith(("https://", "http://", "//"))):
            continue
        try:
            destination = normalize_url("https:" + value if value.startswith("//") else value)
            target = domain_info(urlsplit(destination).hostname)
        except (ValueError, UnicodeError, UnsafeURL):
            continue
        origin_identity = info["registrable_domain"] or host
        target_identity = target["registrable_domain"] or target["hostname"]
        if origin_identity != target_identity:
            add("embedded_redirect", "URL contains an external redirect destination", {"parameter": name,
                "destination": destination, "destination_domain": target_identity, "followed": False}, group="embedded_destination")
    return {**info, "url": url, "indicators": indicators,
            "limitations": ["Brand registry and Unicode lookalike matching are limited; indicators do not prove ownership or fraud.",
                            "Domain parsing uses a bundled Public Suffix List snapshot, including private suffixes; unknown suffixes have no inferred registrable domain."]}


def analyze_redirect(source: str, destination: str, identity_suspicion: bool = False) -> list[dict]:
    origin, target = domain_info(urlsplit(source).hostname), domain_info(urlsplit(destination).hostname)
    origin_identity = origin["registrable_domain"] or origin["hostname"]
    target_identity = target["registrable_domain"] or target["hostname"]
    indicators = []
    if origin_identity != target_identity:
        indicators.append({"code": "cross_domain_redirect", "description": "Redirect changes the registrable domain",
                           "evidence": {"source": source, "destination": destination, "source_domain": origin_identity,
                                        "destination_domain": target_identity}, "strength": "moderate" if identity_suspicion else "weak",
                           "signal_group": "redirect_behavior", "kind": "threat_indicator"})
    if urlsplit(source).scheme == "https" and urlsplit(destination).scheme == "http":
        indicators.append({"code": "https_downgrade", "description": "HTTPS redirects to unencrypted HTTP",
                           "evidence": {"source": source, "destination": destination}, "strength": "weak",
                           "signal_group": "transport", "kind": "security_configuration"})
    return indicators
