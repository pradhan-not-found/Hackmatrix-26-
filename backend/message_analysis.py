"""Explainable SMS and message spam/scam analysis."""

import re
from functools import lru_cache
from pathlib import Path

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
    ("urgency_pressure", re.compile(r"\b(?:immediately|urgent|act now|within \d+ hours?|expires today|right away|final warning|suspended unless)\b", re.I), "Urgency or consequence pressure"),
    ("impersonation", re.compile(r"\b(?:dear customer|bank security|support team|tax department|delivery service|government notice)\b", re.I), "Generic authority or service identity claim"),
]


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

    suspicious_domains = []
    for value in prepared["urls"]:
        host = re.sub(r"(?i)^https?://", "", value).split("/", 1)[0].lower().removeprefix("www.")
        if host in SHORTENERS:
            suspicious_domains.append({"url": value, "reason": "Known URL-shortening domain; destination is obscured"})
    if suspicious_domains:
        matched.append({"code": "shortened_url", "name": "URL shortener hides the destination",
                        "evidence": [item["url"] for item in suspicious_domains]})
    if prepared["urls"] and not suspicious_domains:
        matched.append({"code": "message_url", "name": "Message contains a link requiring independent verification",
                        "evidence": prepared["urls"]})

    prediction = _model_prediction(text)
    heuristic_points = min(100, sum(18 if item["code"] in {"banking_kyc", "otp_theft", "credential_harvesting", "payment_request"} else 12 for item in matched))
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
