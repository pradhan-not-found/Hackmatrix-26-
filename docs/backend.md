# URL investigation backend

Python 3.11+ is required. From the repository root:

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Open http://127.0.0.1:8000/ for the investigation dashboard, or
http://127.0.0.1:8000/docs for the interactive API.

The dashboard submits real investigations and shows saved history, assessment
coverage, evidence, individual checks, redirects, TLS details, and raw JSON.
Reports can be exported as JSON. Recent reports are loaded from SQLite with
pagination; a report's URL fragment allows reopening it directly. It uses the
same origin as the API, with no frontend build or additional runtime dependencies.

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/investigations -Method Post -ContentType application/json -Body '{"url":"https://example.com"}'
```

`POST /api/investigations` returns a completed report (201). It runs synchronously;
`GET /api/investigations/{id}` retrieves the saved report.
`GET /api/investigations?limit=30&offset=0` returns recent report summaries,
newest first (maximum limit 100). `GET /health` is a liveness check.
SQLite defaults to `data/investigations.sqlite3`; override with `INVESTIGATION_DB`.
No model training, vector database, or RAG is required.

## Reputation lookup

Create a Google Cloud project, enable **Safe Browsing APIs**, and create an API key
as described in [Google's setup guide](https://developers.google.com/safe-browsing/v4/get-started).
Restrict the key to that API. In the repository root:

```powershell
Copy-Item .env.example .env
```

Edit the ignored `.env` file and set `GOOGLE_SAFE_BROWSING_API_KEY=your_key`.
Install updated requirements and restart the server. The provider reads `.env`
directly; a process environment variable takes precedence (an empty one disables
the provider). Keys are never included in reports or error messages.

Without a key, the check is explicitly unavailable. Configuration errors, quota
exhaustion, timeouts, TLS failures, and invalid responses have distinct error codes
in the report's threat intelligence check. URLs, including query strings, are sent to Google when enabled; obtain
user consent before enabling this for other users. Review Google's current terms
and attribution requirements before public deployment:
https://developers.google.com/safe-browsing/v4/lookup-api

### Validate the provider

With the key configured, run:

```powershell
.venv\Scripts\python -m backend.validate_threat_intelligence
```

This sends three real API requests: `https://example.com/` (expected no match),
Google's [documented v4 MALWARE test URL](https://github.com/google/safebrowsing/blob/master/README.md)
(expected MALWARE match), and an intentionally invalid key (expected HTTP
400/401/403, reported as unavailable). It never visits the submitted URLs.
The invalid key is used for that request only and does not replace your key.
Results, source, and UTC timestamps are saved to the ignored
`data/threat-intelligence-validation.json`. Exit code 0 means all three passed;
missing configuration, failed lookups, or unexpected matches produce exit code 1.
Do not describe skipped or mocked checks as live validation.

The exact provider test URL is:

```text
http://testsafebrowsing.appspot.com/apiv4/ANY_PLATFORM/MALWARE/URL/
```

You can also submit it to the dashboard to test the complete investigation report.
It should be Confirmed Malicious **only if the provider returns a matching listing**;
this is a provider test fixture, not evidence of an actual malicious deployment.
Past reports are snapshots; run a new investigation after configuring the key.
The automated unit suite exercises all three outcomes with mocked provider
responses, including classification through the investigation pipeline.

## Assessment behavior

- A validated provider match produces Confirmed Malicious.
- URL heuristics, unencrypted transport, or failed certificate verification produce Suspicious.
- With completed network and reputation checks and no threat indicators, the result is Low Risk.
- Otherwise the result is Inconclusive. Missing headers alone do not indicate phishing.

Reports contain findings with sources, evidence, timestamps, recommendations,
per-check results, redirect details, coverage, and limitations. TLS uses the system
trust store and verifies the original hostname while connecting to a validated IP.
Requests use HEAD, standard ports only, no cookies, and no environment proxies.
All DNS answers must be public; every redirect is revalidated. Up to six requests
are permitted, with five-second socket timeouts and a budget checked between hops.
DNS resolution uses the OS resolver and is not covered by the socket timeout;
socket timeouts are inactivity limits, not a hard whole-investigation deadline.

## Tests

```powershell
.venv\Scripts\python -m pip install -r requirements-dev.txt
.venv\Scripts\python -m unittest discover -s tests -v
```

Browser interaction tests use installed Microsoft Edge and a temporary local server
with mocked API responses (no outbound scans):

```powershell
.venv\Scripts\python -m unittest discover -s tests -p dashboard_browser.py -v
```

Tests use mocked network/provider responses, including three benign and three
suspicious cases. They do not establish real-world phishing detection accuracy.

## Deployment limits

This is a local MVP. Run one worker; the four-scan concurrency limit is per process.
Before public exposure add authentication, per-user rate limits, retention/deletion
controls, network egress restrictions, and a durable worker with hard job deadlines.
Reports contain submitted URLs and may contain sensitive query strings; protect the database.
HEAD-only checks cannot inspect page content, and some websites reject HEAD.
Revocation, compromised-CA intelligence, CT monitoring, signature/key-strength
analysis, scam-message analysis, and blockchain reporting are not implemented.
API provider failures never count as clean reputation results.

## Local explanations (default)

New investigations automatically include a rule-based explanation of the
assessment, findings, individual check outcomes, and next steps. No model, API
key, training, RAG, or external explanation request is needed. Every statement
references evidence in the report. Existing saved reports can use **Explain
findings** to generate a local explanation. Detailed interpretations and next
steps expand beneath the summary.

`POST /api/investigations/{id}/explanation` defaults to local rules, even if a
Gemini key is configured. Missing reputation data still means incomplete coverage;
local explanations do not replace the Safe Browsing lookup or prove a site safe.
The existing `ai_explanation` JSON field is retained for report compatibility,
and its `provider` identifies local versus Gemini output.

## Message spam/scam analysis

`POST /api/analyze-message` runs an independent text-analysis path; it does not
change or call the URL investigation pipeline. It normalizes whitespace, extracts
URLs, phone numbers and email addresses, applies transparent indicators for
KYC/banking, prizes, OTPs, jobs, payment, credentials, urgency and impersonation,
then adds an optional TF-IDF classifier prediction. URLs are reported as extracted
text and are not opened, reputation checked or asserted to be malicious. The
endpoint does not persist raw message text.

Install the pinned scikit-learn and joblib dependencies from `requirements.txt`.
Download the CC BY 4.0 [UCI SMS Spam Collection](https://archive.ics.uci.edu/dataset/228/sms%2Bspam%2Bcollection),
extract the tab-separated `SMSSpamCollection`, then train from the repository root:

```powershell
.venv\Scripts\python -m backend.train_message_model path\to\SMSSpamCollection
```

The training command uses an 80/20 stratified split with a fixed seed. It reports
accuracy, spam precision/recall/F1, a confusion matrix, and per-class metrics for
Logistic Regression and Multinomial Naive Bayes, then saves the Logistic Regression
model plus its fitted TF-IDF vectorizer to `backend/models/message_classifier.joblib`.
Evaluation output is saved at `data/message-model-metrics.json`. The model artifact
is a local generated file and should be retrained when dependency versions change.
For the 5,574-row UCI dataset with this configuration, the 1,115-message stratified
test split produced the following observed results (positive class: `spam`):

| Model | Accuracy | Spam precision | Spam recall | Spam F1 | Confusion matrix (`ham`, `spam` rows/columns) |
| --- | ---: | ---: | ---: | ---: | --- |
| Logistic Regression | 98.39% | 94.56% | 93.29% | 93.92% | `[[958, 8], [10, 139]]` |
| Multinomial Naive Bayes | 96.77% | 100.00% | 75.84% | 86.26% | `[[966, 0], [36, 113]]` |

These are held-out results from this dataset and split, not expected production
accuracy or measured scam-detection performance.

Example request:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/analyze-message -Method Post -ContentType application/json -Body '{"message":"Your bank account is blocked. Verify your KYC immediately."}'
```

Example response shape (model confidence and wording depend on the trained artifact):

```json
{
  "classification": "Likely scam or spam",
  "risk_level": "High",
  "confidence": 0.687,
  "model_prediction": {"status": "available", "label": "spam", "confidence": 0.687, "model": "LogisticRegression"},
  "heuristic_risk_score": 42,
  "indicators": [
    {"code": "banking_kyc", "name": "Banking or account verification language", "evidence": ["bank account", "KYC"]},
    {"code": "urgency_pressure", "name": "Urgency or consequence pressure", "evidence": ["immediately"]},
    {"code": "shortened_url", "name": "URL shortener hides the destination", "evidence": ["https://bit.ly/claim"]}
  ],
  "extracted_urls": ["https://bit.ly/claim"],
  "extracted_phone_numbers": [],
  "extracted_email_addresses": [],
  "explanation": "The text model predicted spam with 69% confidence. Heuristic indicators: 3. Extracted links are not reputation checked and are not labelled malicious.",
  "recommendation": "Do not reply, open links, share codes or credentials, or send money. Verify the claim using an independently obtained official contact."
}
```

The response includes `classification`, `risk_level`, `confidence`, a separate
`model_prediction`, `heuristic_risk_score`, indicator names and original text
evidence, extracted links/contact details, an explanation, a recommended action,
and limitations. The maximum message length is 10,000 characters; empty or
oversized messages receive HTTP 422. Missing or unloadable model files do not stop
the endpoint: the model prediction is marked unavailable, and heuristic indicators
continue to be returned. In that case the risk level may be `Unknown`.

The UCI corpus is an older English ham/spam dataset, not a labelled banking-fraud
or phishing dataset. Its model output is a spam/ham prediction, not a verified fraud
finding. Indicator phrases can occur in legitimate messages, and messages in other
languages or newer scam patterns may not be detected. `confidence` is the classifier's
spam/ham class probability, not a calibrated probability that the sender is fraudulent;
heuristic score is returned separately. The default explanation is local. To request
Gemini explicitly, append `?provider=gemini`; only the classification, model result,
indicator names/codes, heuristic score and limitations are sent. Raw message text,
evidence snippets, extracted URLs, phone numbers and email addresses are excluded.
The existing Gemini key/model configuration is reused, and provider errors leave the
local analysis available in the response.

## Optional Gemini explanations

Add a [Google AI Studio API key](https://aistudio.google.com/apikey) to `.env`:

```dotenv
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-3.8-flash
```

Gemini is available only through an explicit request to
`POST /api/investigations/{id}/explanation?provider=gemini`.
The dashboard uses local explanations and does not call Gemini.
The response is saved with the report and included in JSON exports. Errors and
quota limits appear in the dashboard; the underlying report remains available.
The model defaults to `gemini-3.8-flash`, verified against the live model list.
The explanation has a 45-second socket timeout and uses low thinking effort.

The hostname, finding descriptions, selected evidence, check statuses, coverage,
and limitations are sent to Google. URL paths, queries, raw response headers, and
certificate identities are excluded. Existing provider data policies and API
quotas apply; never put the key in browser code or source control.

Gemini receives structured evidence as untrusted input and returns schema-validated
JSON. Every statement must reference existing evidence IDs. Unknown references,
extra fields, and incomplete generations are rejected. Reference validation does
not prove that a statement logically follows from its evidence; review the source
checks. Gemini cannot change the deterministic risk classification.

AI explanations are implemented for URL investigation reports; message analysis
uses local rule-based explanations and blockchain reporting remains outside this
endpoint.
