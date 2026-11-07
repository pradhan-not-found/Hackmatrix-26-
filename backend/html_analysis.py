"""Static HTML evidence extraction. No scripts, forms, or resources are executed."""

import re
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit

from backend.network import normalize_url
from backend.url_analysis import BRANDS, analyze_url, domain_info


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title, self.headings, self.forms, self.controls = [], [], [], []
        self.resources, self.refreshes = [], []
        self.base = None
        self.current_form = None
        self.capture = None
        self.inert = []
        self.tags = 0

    def handle_starttag(self, tag, attrs):
        self.tags += 1
        if self.tags > 10000:
            raise ValueError("HTML tag inspection limit reached")
        if tag in ("script", "style", "template", "noscript"):
            if not self.inert and tag == "script":
                self.resources.extend([("script", value) for name, value in attrs if name == "src" and value])
            self.inert.append(tag)
            return
        if self.inert:
            return
        attrs = dict(attrs)
        if tag == "base" and self.base is None and attrs.get("href"):
            self.base = attrs["href"]
        if tag in ("title", "h1"):
            self.capture = tag
        if tag == "form" and len(self.forms) < 100:
            self.current_form = len(self.forms)
            self.forms.append({"id": attrs.get("id"), "action": attrs.get("action", ""),
                               "method": (attrs.get("method") or "get").lower()})
        if tag in ("input", "button") and len(self.controls) < 500:
            control_type = (attrs.get("type") or ("submit" if tag == "button" else "text")).lower()
            if "disabled" not in attrs:
                self.controls.append({"owner": self.current_form, "form": attrs.get("form"),
                                      "password": control_type == "password",
                                      "payment": bool(set((attrs.get("autocomplete") or "").lower().split()) & {"cc-number", "cc-csc", "cc-exp"}),
                                      "override": attrs.get("formaction") if control_type in ("submit", "image") else None,
                                      "method": attrs.get("formmethod")})
        if len(self.resources) < 100:
            if (tag in ("img", "iframe", "audio", "video", "source") or (tag == "input" and (attrs.get("type") or "").lower() == "image")) and attrs.get("src"):
                self.resources.append((tag, attrs["src"]))
            if tag == "link" and "stylesheet" in (attrs.get("rel") or "").lower().split() and attrs.get("href"):
                self.resources.append(("stylesheet", attrs["href"]))
            if tag in ("img", "source") and attrs.get("srcset"):
                self.resources.extend((tag, value.strip().split()[0]) for value in attrs["srcset"].split(",")[:10] if value.strip())
            if tag == "video" and attrs.get("poster"):
                self.resources.append(("poster", attrs["poster"]))
        if tag == "meta" and (attrs.get("http-equiv") or "").lower() == "refresh" and len(self.refreshes) < 20:
            self.refreshes.append(attrs.get("content") or "")

    def handle_endtag(self, tag):
        if self.inert:
            if self.inert[-1] == tag:
                self.inert.pop()
            return
        if tag == "form":
            self.current_form = None
        if tag == self.capture:
            self.capture = None

    def handle_data(self, data):
        if not self.inert and self.capture:
            target = self.title if self.capture == "title" else self.headings
            if sum(map(len, target)) < 600:
                target.append(data[:300])


def resolve(reference: str, base: str) -> str | None:
    try:
        target = urljoin(base, reference)
        return normalize_url(target) if urlsplit(target).scheme in ("http", "https") else None
    except (ValueError, UnicodeError):
        return None


def identity(url: str) -> str:
    info = domain_info(urlsplit(url).hostname)
    return info["registrable_domain"] or info["hostname"]


def analyze_html(text: str, url: str) -> dict:
    parser = PageParser()
    parser.feed(text)
    parser.close()
    base = resolve(parser.base, url) if parser.base else url
    base = base or url
    title = " ".join(" ".join(parser.title).split())[:300]
    heading = " ".join(" ".join(parser.headings).split())[:300]
    host = urlsplit(url).hostname
    findings, forms, refreshes = [], [], []

    def add(code, description, evidence, impact, remediation, kind="security_configuration", strength="weak", group="page_configuration", severity="medium"):
        findings.append({"code": code, "description": description, "evidence": evidence,
                         "impact": impact, "remediation": remediation, "kind": kind,
                         "strength": strength, "signal_group": group, "severity": severity,
                         "limitations": "Static HTML indicators require context and do not prove fraud. No form was submitted or destination fetched."})

    for index, form in enumerate(parser.forms):
        if len(forms) >= 200:
            break
        controls = [control for control in parser.controls if
                    (control["form"] is not None and form["id"] and control["form"] == form["id"])
                    or (control["form"] is None and control["owner"] == index)]
        password = any(control["password"] for control in controls)
        payment = any(control["payment"] for control in controls)
        targets = [(form["action"], form["method"], "action")]
        targets += [(control["override"], control["method"] or form["method"], "formaction")
                    for control in controls if control["override"] is not None]
        for reference, method, source in targets:
            if len(forms) >= 200:
                break
            method = method.lower()
            method = method if method in ("get", "post", "dialog") else "get"
            if method == "dialog":
                continue
            destination = resolve(reference, base) if reference else url
            forms.append({"form_index": index + 1, "destination": destination, "method": method,
                          "has_password": password, "has_payment_fields": payment,
                          "destination_source": source, "submitted": False})

    sensitive_forms = [form for form in forms if form["has_password"] or form["has_payment_fields"]]
    mismatch = False
    names = set(re.findall(r"[a-z]+", (title + " " + heading).lower()))
    naming = analyze_url(url)["indicators"]
    for brand, roots in BRANDS.items():
        if brand not in names or any(host == root or host.endswith("." + root) for root in roots):
            continue
        mismatch = True
        corroborated = any(item["strength"] in ("moderate", "strong") and item["evidence"].get("brand") == brand for item in naming)
        add("page_brand_mismatch", "Page heading mentions a brand on an unverified domain",
            {"brand": brand, "title": title, "heading": heading, "hostname": host, "known_domains": list(roots), "sensitive_form_count": len(sensitive_forms)},
            "Users may mistake the page for the named organisation; third-party integrations may also explain the mention.",
            "Verify the organisation's official login address independently.", "threat_indicator",
            "strong" if sensitive_forms and corroborated else "moderate" if sensitive_forms else "weak", "page_identity",
            "high" if sensitive_forms and corroborated else "medium" if sensitive_forms else "info")

    for form in sensitive_forms:
        destination = form["destination"]
        if not destination:
            add("unresolved_form_action", "Sensitive form has a non-HTTP or unresolvable action", form,
                "The submission destination could not be assessed statically.", "Review the form's submission behavior before entering sensitive data.", severity="info")
            continue
        if urlsplit(destination).scheme == "http":
            add("insecure_sensitive_form", "Sensitive form submits over unencrypted HTTP", form,
                "Credentials or payment details could be exposed in transit.", "Website owner: submit sensitive forms over HTTPS only.", severity="high")
        if form["method"] == "get":
            add("sensitive_form_get", "Sensitive form uses the GET method", form,
                "Sensitive values could appear in URLs, browser history, and logs.", "Website owner: use an appropriate POST endpoint over HTTPS.", severity="high")
        if identity(destination) != identity(url):
            add("external_sensitive_form", "Sensitive form submits to a different registrable domain", form,
                "Sensitive information would leave this website; legitimate identity and payment providers can also use this pattern.",
                "Verify the destination provider and expected authentication flow before submitting.", "threat_indicator",
                "moderate" if mismatch else "weak", "credential_destination", "medium" if mismatch else "info")

    mixed = []
    if urlsplit(url).scheme == "https":
        for tag, reference in parser.resources[:100]:
            destination = resolve(reference, base)
            if destination and urlsplit(destination).scheme == "http":
                mixed.append({"element": tag, "url": destination, "fetched": False})
    if mixed:
        add("mixed_content_reference", "HTTPS page references unencrypted resources", mixed,
            "These references may be blocked, upgraded, or expose content depending on browser policy.",
            "Website owner: serve all page resources over HTTPS.")
    for content in parser.refreshes:
        match = re.match(r"\s*([0-9.]+)\s*;\s*url\s*=\s*(.+)", content, re.I)
        if match:
            destination = resolve(match[2].strip().strip("\"'"), base)
            if destination:
                refreshes.append({"destination": destination, "delay": match[1], "followed": False})
    if refreshes:
        add("meta_refresh", "Page declares an HTML refresh redirect", refreshes,
            "A browser may navigate beyond the observed HTTP redirect chain; the destination was not visited.",
            "Review the declared navigation destination independently.", "threat_indicator", group="declared_navigation", severity="info")
    limitations = ["Static parse only: no JavaScript, stylesheets, frames, resources, or form actions are executed or fetched.",
                   "Title/heading brand matches use a limited registry and do not establish ownership or impersonation.",
                   "Browser DOM repair, CSS resource URLs, disabled fieldsets, and script-driven forms are not fully modeled."]
    limited = len(parser.forms) >= 100 or len(parser.controls) >= 500 or len(parser.resources) >= 100 or len(forms) >= 200
    if limited:
        limitations.append("Element limits reached; some page elements were not inspected.")
    return {"url": url, "base_url": base, "title": title, "heading": heading, "form_count": len(parser.forms), "limited": limited,
            "forms": forms, "mixed_content": mixed, "meta_refreshes": refreshes,
            "findings": findings, "limitations": limitations}
