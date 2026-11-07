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

Optionally set `GOOGLE_SAFE_BROWSING_API_KEY` before starting the server to enable
Google Safe Browsing v4 threat matches. Without a key, the check is explicitly
unavailable. URLs, including query strings, are sent to Google when enabled; obtain
user consent before enabling this for other users. Review Google's current terms
and attribution requirements before public deployment:
https://developers.google.com/safe-browsing/v4/lookup-api

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
analysis, scam-message analysis, AI explanations, and blockchain reporting are not implemented.
API provider failures never count as clean reputation results.
