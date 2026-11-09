# URL investigation backend

Python 3.11+ is required. From the repository root:

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Open http://127.0.0.1:8000/docs for the interactive API. The backend is API-only;
the standalone dashboard and its assets have been removed. Use the WebAssure
frontend below for investigations and reports.

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/investigations -Method Post -Headers @{Authorization="Bearer YOUR_SUPABASE_ACCESS_TOKEN"} -ContentType application/json -Body '{"url":"https://example.com"}'
```

`POST /api/investigations` returns a completed report (201). It runs synchronously;
`GET /api/investigations/{id}` retrieves the saved report.
`GET /api/investigations?limit=30&offset=0` returns recent report summaries,
newest first (maximum limit 100). `GET /health` is a liveness check.
Investigations are saved to Supabase and scoped to the verified signed-in user.
Apply the schema and configure both environments as described in [Supabase setup](auth.md).
No model training, vector database, or RAG is required.

## Run the WebAssure frontend

Keep FastAPI running on port 8000 in one terminal. In a second terminal:

```powershell
cd webassure
npm ci
npm run dev
```

Open http://localhost:3000/login and sign in through Google or email.
Development writes compiled assets to `webassure/.next-dev`; production build/start
uses `webassure/.next`. This prevents verification builds from overwriting an
active development server's chunks. Restart Next.js after updating this config.
Supabase provides real authentication. Scans, Reports, and
Overview now use real backend investigation data; they contain no seeded scans or
browser-generated risk scores. Submit a URL in the top bar. The saved report opens
with backend classification, coverage, findings, local explanations, individual
checks, redirects, TLS details, limitations, and a full JSON export. Refreshing a
report URL reopens it by its database ID. History loads 30 records at a time with
**Load more**; filters and overview assessment counts apply to loaded records.

Next.js proxies `/api/investigations` to `http://127.0.0.1:8000` on the server;
the user's bearer token is forwarded and verified by FastAPI. To use another backend,
set the server-side `BACKEND_URL` environment variable before starting Next.js.
Keep the root `.env` API keys on the backend; do not copy them into frontend
variables. The proxy has a 90-second timeout. A timed-out submission may still
finish in the backend, so refresh saved history before retrying it.

Certificates now displays real saved TLS evidence and on-demand HTTPS inspections.
Scheduled monitoring and validated campaign attribution are not implemented. The
Threats page compares loaded reports for shared evidence (see below). The threat ledger supports local EVM registration
and independent verification; see [ledger setup](ledger.md).
This integration does not make the application ready for public multi-user use;
the deployment limits below still apply.

Frontend proxy checks and full browser integration checks:

```powershell
npm --prefix webassure test
npm --prefix webassure run build
.venv\Scripts\python -m unittest discover -s tests -p webassure_browser.py -v
```

The browser suite starts Next.js and FastAPI with mocked Supabase Auth and a temporary SQLite fixture database.
Outbound DNS, HTTP/TLS probes, and reputation responses are mocked; submissions,
proxying, persistence, retrieval, and exports run through the real application.

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
- Significant phishing indicators produce Suspicious. High Risk requires indicators
  from at least two distinct signal groups, including at least one strong indicator.
- A critical severity alone never confirms maliciousness. Confirmation requires an
  explicit matching threat-provider result.
- HTTP transport, certificate problems, and missing headers are configuration
  findings, separate from the phishing classification. Weak naming signals alone
  do not establish phishing.
- Low Risk requires successful core URL, DNS, HTTP, TLS (where applicable), redirect,
  header, HTML (where applicable), and reputation checks without significant phishing indicators. HTTP error
  or unsupported responses cannot satisfy this coverage requirement.
- Otherwise the result is Inconclusive. Low Risk never guarantees website safety.

`assessment` records the policy version, decision rule, relevant finding IDs,
signal groups, and configuration finding IDs. `evidence_coverage.checks` aggregates
per-hop results into completed, partial, unavailable, failed, blocked, not_run, or
not_applicable states. Revocation and CT checks are explicitly not_implemented.
Leaf key-strength and signature checks are implemented auxiliary checks, reported
separately from core phishing coverage. These are
documented heuristic rules, not calibrated probabilities.

### URL and redirect analysis

Each URL encountered in the actual HTTP redirect chain receives offline analysis.
`url_analysis` records ASCII/Unicode hostnames, registrable domain, subdomain,
public/private suffix, indicators, and limitations. Domain boundaries use the
bundled Public Suffix List in `tldextract`, including private hosting suffixes;
there are no runtime suffix-list downloads or cache writes. Unknown suffixes have
no inferred registrable domain. Update dependencies to refresh bundled data.
IDNA normalization uses UTS 46 and IDNA 2008 processing.

A small curated registry covers example official roots for PayPal, Google,
Microsoft, Amazon, Apple, and GitHub. This is not comprehensive ownership
verification. Exact known roots and their subdomains skip brand-name heuristics;
they do not bypass reputation or other checks. An embedded official root in an
unrelated hostname and Unicode brand lookalikes are strong naming indicators.
Single-edit/transposed names or brand tokens become moderate indicators only
with credential-related hostname/path context. Plain punycode, mixed scripts,
unusual structure, and close spellings without context remain weak advisories.
Unicode matching uses bundled confusable data and is deliberately limited;
it does not claim complete UTS 39 spoof detection.

Recognized redirect query parameters are decoded at most twice and inspected as
data only; their destinations are never fetched or treated as observed redirects.
Actual cross-domain HTTP redirects are weak by default and moderate when
corroborating significant naming indicators. Identity signals share one group,
so several variants of the same hostname concern cannot alone create High Risk.
HTTPS downgrades are separate configuration findings, not proof of phishing.
All actual redirect destinations retain the existing SSRF validation and pinned
connection checks. A bounded GET retrieves the terminal page; JavaScript remains unexecuted.

### Static HTML inspection

The pinned HTTP client requests HTML using GET and `Accept-Encoding: identity`.
Only successful responses declared as `text/html` or `application/xhtml+xml` are
read. Bodies are capped at 2 MiB, including responses without Content-Length.
Oversized HTML is inspected only up to the cap and reported as partial; attachments and compressed bodies are skipped. A
five-second absolute socket deadline interrupts slow headers and slow body streams;
redirects are returned to the existing validated traversal loop, never automatically
followed. Non-HTML bodies are not read.

The parser extracts title/heading text, sensitive forms (password inputs or payment
autocomplete fields), submission methods and destinations, mixed-content references,
and meta-refresh declarations. It accounts for the first base URL, external form
ownership, and submit-button destination overrides. No input values, raw HTML,
scripts, or full page text are persisted. `page_analysis` contains selected parsed
observations; each HTML finding includes evidence, impact, remediation, and limitations.
Actual page titles and destination URLs remain untrusted data and may still contain
sensitive information, so protect stored reports and exports.

HTTP sensitive-form actions and GET submission are configuration findings. A
cross-domain form alone is a weak advisory because third-party login/payment
providers can be legitimate. A title/heading brand mismatch needs a sensitive form
to become significant; corroborating hostname evidence can strengthen it. No HTML
heuristic produces Confirmed Malicious. Mixed content and refresh destinations
are reported as declarations, not proof of resource loading or observed navigation.
Form actions, refresh destinations, images, scripts, and frames are never fetched.

HTML inspection is a core check in policy 2.1. Skipped, oversized, truncated,
unparseable, or element-limited HTML cannot silently produce Low Risk. Non-HTML
responses are explicitly not_applicable. The parser limits forms, controls, targets,
resources, and tags. It does not model a browser's DOM repairs, scripts, CSS URLs,
or disabled-fieldset behavior completely. Existing saved reports are unchanged;
run a new investigation to inspect HTML. WebAssure shows page observations in
**Checks**, and complete selected metadata under **Evidence** and JSON exports.

Reports contain findings with sources, evidence, timestamps, recommendations,
per-check results, redirect details, coverage, and limitations. TLS uses the system
trust store and verifies the original hostname while connecting to a validated IP.
Requests use GET, standard ports only, no cookies, and no environment proxies.
All DNS answers must be public; every redirect is revalidated. Up to six requests
are permitted, with five-second absolute request deadlines and a budget checked between hops.
DNS resolution uses the OS resolver and is not covered by the socket timeout;
the hop budget is not a hard whole-investigation deadline.

## Leaf certificate inspection

The target HTTPS client augments the system trust store with the pinned `certifi`
Mozilla CA bundle. This avoids missing-public-root failures in Python/OpenSSL on
Windows while retaining hostname verification and `CERT_REQUIRED`. Issuer URLs
are not fetched and TLS verification is never disabled. Update the pinned bundle
as part of dependency maintenance. Old saved TLS failures remain historical
snapshots; run a fresh investigation after applying a trust-store fix.

Install the pinned `cryptography` dependency from `requirements.txt`. Following a
successful hostname- and system-trust-verified TLS handshake, the client parses
the leaf certificate DER with [cryptography X.509](https://cryptography.io/en/latest/x509/reference/).
It records subject, issuer, UTC validity dates, DNS/IP SANs, serial number,
SHA-256 fingerprint, public-key metadata and signature algorithm/hash. No new
outbound certificate, OCSP or CT requests are introduced, and trust verification
is never bypassed to collect invalid certificates.

The explicit `leaf-crypto-v1` local policy flags RSA below 2048 bits, EC below
256 bits, legacy DSA keys, MD5/SHA-1 signatures and hashes below 256 bits.
Supported acceptable keys are RSA >=2048, P-256/P-384/P-521, Ed25519 and Ed448;
supported signature hashes are SHA-256/384/512 and intrinsic EdDSA signatures.
Other algorithms/curves are unassessed, not automatically weak or acceptable.
These are scoped policy checks, not a complete cryptographic security audit.

Weaknesses produce separate configuration findings with evidence, impact and
remediation. They never establish phishing or maliciousness. Parsing failures
leave TLS verification intact but mark cryptographic checks unavailable. The
phishing policy's existing core coverage requirement is unchanged. Intermediate
key strength, revocation, CT and CA compromise intelligence remain unassessed.

Certificates uses the latest observation per host from loaded saved reports,
including redirect hosts and failed TLS observations. It displays incomplete
checks for older reports rather than fabricating metadata. Users can request a
fresh HTTPS investigation, open its evidence report, and load older history.
This is on-demand inspection with saved snapshots, not scheduled monitoring.

## Related investigations

The Threats page replaces its sample campaign list with deterministic connections
across the user's loaded saved investigations. Existing owner-scoped report APIs
are used; no public feed, cross-account lookup, new database grants, AI call or
extra outbound website request is introduced.

Domain matches use exact normalized HTTP(S) hostnames from the submitted URL and
actual collected redirect-chain responses. Evidence distinguishes a submitted
host, an HTTP response host and an observed redirect destination. Unfetched query
parameters and URL-analysis suggestions are not treated as observed redirects.
Public suffixes, shared IPs and issuing CA names do not establish connections.

Certificate connections require matching full SHA-256 leaf fingerprints from
successfully verified TLS observations. Matching fingerprints can be legitimate
(for example, shared certificates); this is evidence of a relationship, not proof
of a fraud campaign. Repeated scans of one target are labeled repeated observations.

**Needs review** shows connections involving at least one report already classified
Suspicious, High Risk or Confirmed Malicious. The relation never changes another
report's classification. **All connections** includes benign repeated observations.
Each connection lists its evidence roles, individual verdicts and timestamps, and
opens the original report. Filtering and loading more history extend the comparison.
The page states how many reports were compared and explicitly marks partial-load
failures. Matching does not persist new report contents or identifiers externally.

## Tests

```powershell
.venv\Scripts\python -m pip install -r requirements-dev.txt
.venv\Scripts\python -m unittest discover -s tests -v
```

Browser integration tests use installed Microsoft Edge; see the WebAssure commands above.

Tests use mocked network/provider responses, including three benign and three
suspicious cases. They do not establish real-world phishing detection accuracy.

## Deployment limits

This is a local MVP. Run one worker; the four-scan concurrency limit is per process.
Before public exposure add per-user rate limits, retention/deletion
controls, network egress restrictions, and a durable worker with hard job deadlines.
Reports contain submitted URLs and may contain sensitive query strings; protect the database.
Static inspection cannot evaluate script-rendered pages, submit forms, or establish overall website safety.
Revocation, compromised-CA intelligence, CT monitoring and scheduled certificate
monitoring are not implemented. Message analysis is documented below; report
commitment registration and independent verification are documented in [ledger.md](ledger.md).
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

Dedicated email/header and `.eml` analysis is now available in the dashboard.
See [email analysis](email-analysis.md) for its UI, authenticated endpoints,
private backend history and interpretation limits.

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
GEMINI_REPORT_MODEL=gemini-3.5-flash-lite
```

Gemini is available only through an explicit request to
`POST /api/investigations/{id}/explanation?provider=gemini`.
The report's **Generate AI insights** action calls Gemini on demand. It displays
a short assessment, up to three prioritized insights, and up to two concrete next
steps, with expandable supporting evidence. Successful responses are saved with
the report and included in JSON exports. Reopening the report costs no generation
tokens. The backend reuses saved insights when their minimized evidence fingerprint
and insight-format version match, and coalesces simultaneous requests per report
in this single-process MVP. Failures do not replace the saved local explanation;
the dashboard shows an explicit retry action without automatically retrying Gemini.
`GEMINI_REPORT_MODEL` can select the lightweight model for report insights while
other Gemini features retain `GEMINI_MODEL`. If it is unset, reports use
`GEMINI_MODEL`. The supplied example uses the live-verified `gemini-3.5-flash-lite`.
The explanation has a 45-second socket timeout and uses low thinking effort.
Report requests cap the serialized evidence at 10,000 characters, prioritize at
most ten findings and twelve grouped check types, and declare omitted evidence.
Output is limited to 1,800 tokens including thinking, with a 180-word target for
the brief. The response records provider token usage when supplied. Message
explanations retain their existing separate configuration.

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
also has its own explicit Gemini action. Blockchain reporting remains outside
this endpoint. A report registered before adding AI insights still verifies its
original exported snapshot; register a new snapshot to commit the updated report.
