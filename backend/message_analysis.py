"""Explainable SMS and message spam/scam analysis."""

import re
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlsplit

MAX_MESSAGE_LENGTH = 10000
MODEL_PATH = Path(__file__).parent / "models" / "message_classifier.joblib"
URL_PATTERN = re.compile(r"(?i)(?<![@\w])(?:https?://|www\.)[^\s<>\"']+|(?<![@\w])\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9-]+)+(?:/[^\s<>\"']*)?")
PHONE_PATTERN = re.compile(r"(?<!\w)(?:\+?\d[\d ()-]{7,}\d)(?!\w)")
EMAIL_PATTERN = re.compile(r"(?i)\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b")
SHORTENERS = {"bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd", "ow.ly", "buff.ly", "cutt.ly", "rb.gy", "shorturl.at"}

INDICATORS = [
    ("banking_kyc", re.compile(r"\b(?:kyc|bank account|account (?:blocked|suspended|frozen)|update (?:your )?(?:bank )?account|verify (?:your )?account)\b", re.I), "Banking or account verification language"),
    ("lottery_prize", re.compile(r"\b(?:lottery|won|winner|prize|cash prize|claim (?:your )?(?:reward|gift))\b", re.I), "Prize, lottery, or reward claim language"),
    ("otp_theft", re.compile(r"\b(?:otp|one[ -]time password|verification code|security code)\b", re.I), "One-time code or verification language"),
    ("job_offer", re.compile(r"\b(?:job offer|work from home|hiring now|daily income|part[ -]time job|registration fee)\b", re.I), "Unsolicited job or income offer language"),
    ("payment_request", re.compile(r"\b(?:pay|payment|transfer|wire|fee|deposit|refund|upi|gift card|crypto(?:currency)?)\b", re.I), "Payment, transfer, or refund language"),
    ("credential_harvesting", re.compile(r"\b(?:password|passcode|login credentials|card details|cvv|pin number|social security)\b", re.I), "Sensitive credential or payment detail request"),
    ("urgency_pressure", re.compile(r"\b(?:immediately|urgent|act now|claim (?:your )?(?:reward|prize|gift|voucher) now|within \d+\s*(?:minutes?|hours?|days?)|expires today|right away|final warning|suspended unless|limited slots?(?: available)?|before midnight|before (?:the )?deadline|last chance|ends? (?:today|tonight))\b", re.I), "Urgency, scarcity, or deadline pressure"),
    ("impersonation", re.compile(r"\b(?:dear customer|bank security|support team|tax department|delivery service|government notice)\b", re.I), "Generic authority or service identity claim"),
]

INDICATOR_WEIGHTS = {
    "banking_kyc": 18, "otp_theft": 18, "credential_harvesting": 18, "payment_request": 18,
    "lottery_prize": 12, "job_offer": 12, "urgency_pressure": 12, "impersonation": 12,
    "message_url": 12, "shortened_url": 18,
    "promotional_reward": 20, "forwarding_incentive": 12, "promotion_related_url": 18,
}
OVERLAPPING_SIGNAL_GROUPS = (
    {"lottery_prize", "promotional_reward"},
    {"message_url", "shortened_url", "promotion_related_url"},
)


def _promotion_reward_evidence(text: str) -> list[str]:
    """Require a reward claim, a tangible reward, and promotional bait language."""
    claim = re.search(r"\b(?:selected|lucky winner|winner|won|claim(?: your)?)\b", text, re.I)
    reward = re.search(r"\b(?:shopping\s+)?(?:voucher|reward|prize|gift|cash|bonus)\b", text, re.I)
    bait = re.search(r"\b(?:free|exclusive|absolutely|bonus|unlock)\b|₹\s?[\d,]+", text, re.I)
    if not (claim and reward and bait):
        return []
    return list(dict.fromkeys(match.group(0) for match in (claim, reward, bait)))


def _promotion_url_evidence(urls: list[str]) -> list[str]:
    """Identify promotional wording in a link when the message also promises rewards."""
    promo_terms = re.compile(r"(?:^|[-_./])(?:deal|deals|reward|voucher|gift|bonus|claim|offer|promo|shop)(?:$|[-_./])", re.I)
    evidence = []
    for url in urls:
        candidate = url if re.match(r"(?i)^https?://", url) else f"https://{url}"
        parsed = urlsplit(candidate)
        if promo_terms.search(parsed.hostname or "") or promo_terms.search(parsed.path):
            evidence.append(url)
    return evidence


def calculate_heuristic_risk_score(indicators: list[dict]) -> int:
    """Score unique indicators while taking the strongest signal in overlap groups."""
    codes = {item["code"] for item in indicators}
    grouped_codes = set().union(*OVERLAPPING_SIGNAL_GROUPS)
    score = sum(INDICATOR_WEIGHTS.get(code, 0) for code in codes - grouped_codes)
    for group in OVERLAPPING_SIGNAL_GROUPS:
        score += max((INDICATOR_WEIGHTS.get(code, 0) for code in codes & group), default=0)
    return min(100, score)


def preprocess_message(message: str) -> dict:
    """Normalize whitespace while extracting contact and link evidence from source text."""
    if not isinstance(message, str):
        raise ValueError("Message must be text")
    cleaned = " ".join(message.replace("\x00", " ").split())
    if not cleaned:
        raise ValueError("Message cannot be empty")
    if len(cleaned) > MAX_MESSAGE_LENGTH:
        raise ValueError(f"Message exceeds the {MAX_MESSAGE_LENGTH} character limit")
    urls = []
    for match in URL_PATTERN.finditer(cleaned):
        value = match.group(0).rstrip(".,!?;:)]}")
        if value and value not in urls:
            urls.append(value)
    phones = list(dict.fromkeys(match.group(0).strip() for match in PHONE_PATTERN.finditer(cleaned)))
    emails = list(dict.fromkeys(match.group(0) for match in EMAIL_PATTERN.finditer(cleaned)))
    return {"normalized_text": cleaned, "urls": urls, "phone_numbers": phones, "email_addresses": emails}


@lru_cache(maxsize=1)
def load_model():
    """Load the optional trained sklearn artifact. Failure is explicit and non-fatal."""
    if not MODEL_PATH.is_file():
        raise FileNotFoundError("Message classifier is not trained. Run python -m backend.train_message_model.")
    import joblib

    artifact = joblib.load(MODEL_PATH)
    if not isinstance(artifact, dict) or not {"model", "vectorizer"} <= artifact.keys():
        raise ValueError("Message classifier artifact has an unsupported format")
    return artifact


def _model_prediction(text: str) -> dict:
    try:
        artifact = load_model()
        vector = artifact["vectorizer"].transform([text])
        model = artifact["model"]
        label = str(model.predict(vector)[0])
        probabilities = model.predict_proba(vector)[0]
        confidence = float(max(probabilities))
        return {"status": "available", "label": label, "confidence": round(confidence, 4),
                "model": type(model).__name__}
    except Exception as exc:
        return {"status": "unavailable", "reason": type(exc).__name__, "label": None, "confidence": None, "model": None}


def analyze_message(message: str) -> dict:
    prepared = preprocess_message(message)
    text = prepared["normalized_text"]
    matched = []
    for code, pattern, title in INDICATORS:
        evidence = list(dict.fromkeys(match.group(0) for match in pattern.finditer(text)))
        if evidence:
            matched.append({"code": code, "name": title, "evidence": evidence})

    reward_evidence = _promotion_reward_evidence(text)
    if reward_evidence:
        matched.append({"code": "promotional_reward", "name": "Unrealistic reward claim with promotional bait",
                        "evidence": reward_evidence})

    forwarding_evidence = list(dict.fromkeys(match.group(0) for match in re.finditer(
        r"\bforward\s+(?:this\s+)?(?:message|sms|text)\s+to\s+\d+\s+(?:friends|contacts|people)\b",
        text, re.I)))
    if forwarding_evidence:
        matched.append({"code": "forwarding_incentive", "name": "Forwarding incentive or chain-message request",
                        "evidence": forwarding_evidence})

    suspicious_domains = []
    for value in prepared["urls"]:
        host = re.sub(r"(?i)^https?://", "", value).split("/", 1)[0].lower().removeprefix("www.")
        if host in SHORTENERS:
            suspicious_domains.append({"url": value, "reason": "Known URL-shortening domain; destination is obscured"})
    if suspicious_domains:
        matched.append({"code": "shortened_url", "name": "URL shortener hides the destination",
                        "evidence": [item["url"] for item in suspicious_domains]})
    if prepared["urls"] and not suspicious_domains:
        promotional_urls = _promotion_url_evidence(prepared["urls"]) if reward_evidence else []
        if promotional_urls:
            matched.append({"code": "promotion_related_url", "name": "Link wording reinforces a reward promotion",
                            "evidence": promotional_urls})
        else:
            matched.append({"code": "message_url", "name": "Message contains a link requiring independent verification",
                            "evidence": prepared["urls"]})

    prediction = _model_prediction(text)
    heuristic_points = calculate_heuristic_risk_score(matched)
    model_spam = prediction["label"] == "spam"
    # The classic dataset is binary spam/ham, so keep its output distinct from heuristic assessment.
    if heuristic_points >= 42 or (model_spam and prediction["confidence"] >= 0.80 and heuristic_points >= 12):
        classification, risk_level = "Likely scam or spam", "High"
    elif heuristic_points >= 18 or (model_spam and prediction["confidence"] >= 0.70):
        classification, risk_level = "Suspicious", "Medium"
    elif prediction["status"] == "unavailable":
        classification, risk_level = "Inconclusive", "Unknown"
    else:
        classification, risk_level = "No strong indicators detected", "Low"
    model_confidence = prediction["confidence"]
    confidence = model_confidence
    if risk_level == "High":
        recommendation = "Do not reply, open links, share codes or credentials, or send money. Verify the claim using an independently obtained official contact."
    elif risk_level == "Medium":
        recommendation = "Pause before responding. Verify the sender and any request using an independently obtained official channel."
    elif risk_level == "Unknown":
        recommendation = "Automated model prediction is unavailable. Treat requests for money or sensitive information cautiously and verify independently."
    else:
        recommendation = "No strong indicators were found; this does not prove the message is safe. Verify unexpected requests independently."
    explanation = (f"The text model predicted {prediction['label']}" +
                   (f" with {round(model_confidence * 100)}% confidence" if model_confidence is not None else " (model unavailable)") +
                   f". Heuristic indicators: {len(matched)}. Extracted links are not reputation checked and are not labelled malicious.")
    return {
        "classification": classification, "risk_level": risk_level, "confidence": confidence,
        "model_prediction": {key: prediction[key] for key in ("status", "label", "confidence", "model")},
        "heuristic_risk_score": heuristic_points,
        "indicators": matched, "extracted_urls": prepared["urls"],
        "extracted_phone_numbers": prepared["phone_numbers"], "extracted_email_addresses": prepared["email_addresses"],
        "evidence": [{"indicator": item["code"], "spans": item["evidence"]} for item in matched],
        "explanation": explanation, "recommendation": recommendation,
        "limitations": ["Model labels general SMS spam, not verified fraud or phishing.",
                        "Heuristic phrases can appear in legitimate messages.",
                        "Links are extracted but not opened or reputation checked."],
    }
