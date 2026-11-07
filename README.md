# WebAssure

**Know your website before you trust it.**

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

WebAssure is an AI-assisted web threat detection platform. Paste a suspicious link and get an evidence-based assessment of whether it is safe, suspicious or malicious, with every finding explained in plain language.

Built for the *AI-Powered Web Threat Detection & Digital Trust Intelligence* challenge. See the [problem statement](docs/AI_Web_Threat_Detection_Problem_Statement.md).

---

## Contents

- [Why WebAssure](#why-webassure)
- [What is in this repository](#what-is-in-this-repository)
- [Features](#features)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [API](#api)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Status and limitations](#status-and-limitations)
- [Security and privacy](#security-and-privacy)
- [Team](#team)
- [License](#license)

---

## Why WebAssure

Phishing pages, fake recruitment portals, fraudulent payment links and impersonated brands are increasingly hard to tell apart from the real thing. Most tools return a bare *safe* or *malicious* label. WebAssure instead shows **why**: which checks ran, what each one found, the evidence behind it and what to do next.

## What is in this repository

| Part | Path | Stack | Purpose |
| --- | --- | --- | --- |
| **Web app** | [`webassure/`](webassure/) | Next.js 14, React 18 | Product website, sign-up and login, and the user dashboard |
| **Investigation backend** | [`backend/`](backend/) | Python 3.11+, FastAPI, SQLite | Runs real URL investigations and stores evidence-based reports |
| **Tests** | [`tests/`](tests/) | `unittest`, Playwright | Pipeline, provider, explanation and dashboard tests |
| **Docs** | [`docs/`](docs/) | Markdown | Problem statement and detailed backend guide |

## Features

### Investigation backend (working)

- **Evidence-based URL investigation.** Every report lists findings with their source, evidence, timestamps and recommendations, plus per-check results, coverage and limitations.
- **Safe network inspection.** HEAD-only requests on standard ports, public-DNS validation, every redirect revalidated, a request budget and socket timeouts. No cookies, no proxies.
- **TLS verification.** Certificates are verified against the system trust store for the original hostname.
- **Reputation lookup.** Optional Google Safe Browsing integration with explicit, distinct error states. A provider failure never counts as a clean result.
- **Deterministic risk classification:** *Confirmed Malicious*, *Suspicious*, *Low Risk* or *Inconclusive*.
- **Plain-language explanations.** Built-in, rule-based explanations reference the report's evidence. Optional Gemini explanations are schema-validated and cannot change the classification.
- **History.** Reports are saved to SQLite with paginated retrieval and JSON export.
- **Built-in investigation dashboard** served by the backend at `/`.

### Web app (UI prototype)

- **Landing page** with live link checker, product walkthrough, sector coverage, sample report, pricing and FAQ.
- **Sign-up and login** with a hand-off flow: a link pasted on the landing page is scanned automatically after sign-in.
- **Dashboard** with Overview, Scans, Threats, Certificates, Reports, Threat ledger and Settings (profile photo, notifications, API key).
- **Light and dark themes**, responsive layout, SEO metadata, Open Graph image, sitemap, robots rules and web manifest.

> The web app currently uses demo data and browser-local demo authentication, and its link checker runs quick client-side heuristics. It is not yet connected to the investigation backend. See [Status and limitations](#status-and-limitations).

## Architecture

```text
┌──────────────────────────┐        ┌──────────────────────────────────────┐
│  Web app  (webassure/)   │        │  Investigation backend  (backend/)   │
│  Next.js · React         │        │  FastAPI · Python                    │
│                          │  API   │                                      │
│  Landing · Auth · Dash   │ ─ ─ ─▶ │  /api/investigations                 │
│  (demo data today)       │planned │   ├─ URL & DNS validation            │
└──────────────────────────┘        │   ├─ Redirect + TLS inspection       │
                                    │   ├─ Safe Browsing reputation (opt.) │
                                    │   ├─ Risk classification             │
                                    │   └─ Explanation (local / Gemini)    │
                                    │                                      │
                                    │  SQLite report store                 │
                                    └──────────────────────────────────────┘
```

## Getting started

### Prerequisites

- **Node.js 18.17+** and npm, for the web app
- **Python 3.11+**, for the backend
- Optional: a Google Safe Browsing API key and a Gemini API key

### 1. Investigation backend

From the repository root:

```bash
python -m venv .venv
# Windows
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
# macOS / Linux
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

- Dashboard: <http://127.0.0.1:8000/>
- Interactive API docs: <http://127.0.0.1:8000/docs>

### 2. Web app

```bash
cd webassure
npm install
npm run dev
```

Open <http://localhost:3000>. To view the dashboard without signing up, visit <http://localhost:3000/dashboard?demo=1>.

Production build:

```bash
npm run build
npm start
```

## Configuration

Copy the template and fill in the keys you need. `.env` is git-ignored.

```bash
cp .env.example .env        # Windows: Copy-Item .env.example .env
```

| Variable | Required | Description |
| --- | --- | --- |
| `GOOGLE_SAFE_BROWSING_API_KEY` | Optional | Enables reputation lookups. Without it, the check is reported as unavailable. |
| `GEMINI_API_KEY` | Optional | Enables on-demand Gemini explanations. Local explanations work without it. |
| `GEMINI_MODEL` | Optional | Gemini model name (default `gemini-3.8-flash`). |
| `INVESTIGATION_DB` | Optional | SQLite path (default `data/investigations.sqlite3`). |

Never commit `.env` or place keys in browser code.

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/investigations` | Run an investigation. Body: `{"url": "https://example.com"}`. Returns the completed report (`201`). |
| `GET` | `/api/investigations/{id}` | Retrieve a saved report. |
| `GET` | `/api/investigations?limit=30&offset=0` | Recent report summaries, newest first (max `limit` 100). |
| `POST` | `/api/investigations/{id}/explanation` | Generate an explanation. Local by default; add `?provider=gemini` for Gemini. |
| `GET` | `/health` | Liveness check. |

Example:

```bash
curl -X POST http://127.0.0.1:8000/api/investigations \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

Full behaviour, error codes and provider validation are documented in [`docs/backend.md`](docs/backend.md).

## Testing

```bash
# Install test dependencies
python -m pip install -r requirements-dev.txt

# Unit and pipeline tests (mocked network and providers)
python -m unittest discover -s tests -v

# Dashboard browser tests (uses installed Microsoft Edge, no outbound scans)
python -m unittest discover -s tests -p dashboard_browser.py -v

# Live Safe Browsing validation (requires a configured key)
python -m backend.validate_threat_intelligence
```

Tests use mocked responses and do not measure real-world detection accuracy.

## Project structure

```text
.
├── backend/                 FastAPI investigation service
│   ├── main.py              API routes and app setup
│   ├── investigation.py     Investigation pipeline and classification
│   ├── network.py           DNS, redirect and TLS inspection
│   ├── threat_intelligence.py  Safe Browsing provider
│   ├── explanation.py       Local rule-based explanations
│   ├── gemini.py            Optional Gemini explanations
│   └── static/              Built-in investigation dashboard
├── webassure/               Next.js web app
│   ├── public/              Favicon, icons, Open Graph image, manifest
│   └── src/
│       ├── app/             Routes, layout, metadata, robots, sitemap
│       ├── components/      Landing page sections and shared UI
│       ├── views/           Landing, auth and dashboard pages
│       ├── lib/             Demo auth, demo data and link heuristics
│       └── styles/          Design system and page styles
├── tests/                   Backend and dashboard tests
├── docs/                    Problem statement and backend guide
├── requirements.txt
├── requirements-dev.txt
└── .env.example
```

## Status and limitations

WebAssure is a hackathon-stage project. To be clear about what is real today:

| Area | Status |
| --- | --- |
| URL investigation, redirects, TLS verification, risk classification | Working (backend) |
| Safe Browsing reputation lookup | Working with an API key |
| Local and Gemini explanations | Working |
| Web app UI: landing, auth, dashboard | Working, on demo data |
| Web app ↔ backend integration | Planned |
| Real authentication and user accounts | Planned (demo auth stored in the browser) |
| Page-content analysis (HEAD-only today) | Planned |
| Certificate Transparency monitoring, revocation and key-strength analysis | Planned |
| Scam-message analysis | Planned |
| Blockchain threat ledger | Planned (shown as a UI concept) |

The backend is a local MVP. Run a single worker. Before any public deployment, add authentication, per-user rate limits, data retention controls, network egress restrictions and a durable job queue with hard deadlines.

## Security and privacy

- Submitted URLs, including query strings, are stored in the report database. Protect it accordingly.
- When Safe Browsing is enabled, submitted URLs are sent to Google. Obtain user consent before enabling it for others.
- Gemini receives only hostnames, finding descriptions and selected evidence, never URL paths, queries or raw headers.
- API keys are read from `.env` and are never included in reports or error messages.

Found a security issue? Please report it privately to the maintainers rather than opening a public issue.

## Team

WebAssure is built by **Fantastic 4**:

- Aniruddha Das
- Madhushree Dasgupta
- Sattwik Das
- Souradeep Pradhan

## License

Copyright 2026 the WebAssure contributors.

Licensed under the [Apache License, Version 2.0](LICENSE). You may not use this project except in compliance with the License. Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
