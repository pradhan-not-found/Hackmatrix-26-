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
Invoke-RestMethod http://127.0.0.1:8000/api/investigations -Method Post -ContentType application/json -Body '{"url":"https://example.com"}'
```

`POST /api/investigations` returns a completed report (201). It runs synchronously;
`GET /api/investigations/{id}` retrieves the saved report.
`GET /api/investigations?limit=30&offset=0` returns recent report summaries,
newest first (maximum limit 100). `GET /health` is a liveness check.
SQLite defaults to `data/investigations.sqlite3`; override with `INVESTIGATION_DB`.
No model training, vector database, or RAG is required.

## Run the WebAssure frontend

Keep FastAPI running on port 8000 in one terminal. In a second terminal:

```powershell
cd webassure
npm ci
npm run dev
```

Open http://localhost:3000/dashboard/scans?demo to use the existing demo session.
Development writes compiled assets to `webassure/.next-dev`; production build/start
uses `webassure/.next`. This prevents verification builds from overwriting an
active development server's chunks. Restart Next.js after updating this config.
The session is a frontend preview, not real authentication. Scans, Reports, and
Overview now use real backend investigation data; they contain no seeded scans or
browser-generated risk scores. Submit a URL in the top bar. The saved report opens
with backend classification, coverage, findings, local explanations, individual
checks, redirects, TLS details, limitations, and a full JSON export. Refreshing a
report URL reopens it by its database ID. History loads 30 records at a time with
**Load more**; filters and overview assessment counts apply to loaded records.

Next.js proxies `/api/investigations` to `http://127.0.0.1:8000` on the server;
no browser CORS configuration or API keys are needed. To use another backend,
set the server-side `BACKEND_URL` environment variable before starting Next.js.
Keep the root `.env` API keys on the backend; do not copy them into frontend
variables. The proxy has a 90-second timeout. A timed-out submission may still
finish in the backend, so refresh saved history before retrying it.

Certificate monitoring, threat campaigns, ledger entries, and authentication are
still demo features, labeled accordingly. Real TLS evidence is in scan reports.
This integration does not make the application ready for public multi-user use;
the deployment limits below still apply.

Frontend proxy checks and full browser integration checks:

```powershell
npm --prefix webassure test
npm --prefix webassure run build
.venv\Scripts\python -m unittest discover -s tests -p webassure_browser.py -v
```

The browser suite starts Next.js and FastAPI with a temporary SQLite database.
Only outbound DNS, HTTP/TLS probes, and reputation responses are mocked; submissions,
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
not_applicable states. Revocation, CT, and certificate key-strength checks
are explicitly not_implemented and excluded from core coverage. These are
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
read. Bodies are capped at 256 KiB, including responses without Content-Length.
Oversized declarations, attachments, and compressed bodies are skipped. A
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
Before public exposure add authentication, per-user rate limits, retention/deletion
controls, network egress restrictions, and a durable worker with hard job deadlines.
Reports contain submitted URLs and may contain sensitive query strings; protect the database.
Static inspection cannot evaluate script-rendered pages, submit forms, or establish overall website safety.
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

AI explanations are implemented; message analysis and blockchain reporting remain
outside this endpoint.
