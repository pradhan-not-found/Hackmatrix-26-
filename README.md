<div align="center">

<img src="docs/assets/webassure-banner.png" alt="WebAssure: know your website before you trust it" width="100%" />

<br />
<br />

<a href="https://hackmatrix.codes/"><img src="docs/assets/hackmatrix-partners.png" alt="HackMatrix 2026 with ACM Student Chapter, Major League Hacking, Adamas University and RICE Adamas Group" width="560" /></a>

<a href="https://github.com/pradhan-not-found/Hackmatrix-26-/actions/workflows/ci.yml"><img src="https://github.com/pradhan-not-found/Hackmatrix-26-/actions/workflows/ci.yml/badge.svg" alt="CI status" /></a>

<sub>Built at <a href="https://hackmatrix.codes/">HackMatrix 2026</a> · Next.js · FastAPI · Supabase · Apache-2.0</sub>

<br />
<br />

<a href="#problem">Problem</a> &nbsp;·&nbsp;
<a href="#solution">Solution</a> &nbsp;·&nbsp;
<a href="#demo">Demo</a> &nbsp;·&nbsp;
<a href="#tech-stack">Tech stack</a> &nbsp;·&nbsp;
<a href="#architecture">Architecture</a> &nbsp;·&nbsp;
<a href="#setup-and-run">Setup</a> &nbsp;·&nbsp;
<a href="#disclosures">Disclosures</a> &nbsp;·&nbsp;
<a href="#track">Track</a> &nbsp;·&nbsp;
<a href="#team">Team</a>

</div>

---

# WebAssure

**An AI-assisted web threat detection platform: paste a suspicious link, message or certificate and get an evidence-based verdict, with every finding explained in plain language.**

## Problem

Phishing pages, fake recruitment portals, fraudulent payment links and impersonated brands are increasingly hard to tell apart from the real thing. Most tools return a bare *safe* or *malicious* label.

People are asked to trust links every day, from bank KYC notices and job offers to payment requests and delivery updates, with no quick, understandable way to check them. The full challenge brief is in the [problem statement](docs/AI_Web_Threat_Detection_Problem_Statement.md).

## Solution

WebAssure checks a link, message or certificate the way a security analyst would and shows **why**: which checks ran, what each one found, the evidence behind it and what to do next.

### Investigation backend (working)

- **Evidence-based URL investigation.** Every report lists findings with their source, evidence, timestamps and recommendations, plus per-check results, coverage and limitations.
- **Safe network inspection.** Bounded GET requests on standard ports, public-DNS validation, every redirect revalidated, a request budget and socket timeouts. No cookies, no proxies.
- **TLS verification.** Certificates are verified against the system trust store for the original hostname.
- **Reputation lookup.** Optional Google Safe Browsing integration with explicit, distinct error states. A provider failure never counts as a clean result.
- **Deterministic risk classification:** *Confirmed Malicious*, *Suspicious*, *Low Risk* or *Inconclusive*.
- **Plain-language explanations.** Built-in, rule-based explanations reference the report's evidence. Optional Gemini explanations are schema-validated and cannot change the classification.
- **Private history.** Supabase stores paginated reports with owner-only RLS and JSON export. API requests verify the user's Supabase session.
- **Account management.** Google/email sign-in, password recovery, persistent profile/preferences, and avatar uploads through Supabase Storage.
- **Email analysis.** Pasted emails, raw headers and `.eml` files are scored on sender mismatches, reported authentication results, attachments, links and fraud language.
- **Gmail inbox protection.** Each user can connect their own Gmail with read-only access. The latest emails are screened without opening links, likely fraud raises a dashboard alert, and flagged emails join Email analysis. Tokens are encrypted and tied to the verified session ([details](docs/email-analysis.md)).
- **Message spam/scam analysis.** A separate endpoint combines a trained text classifier with explainable indicators and does not open extracted links.
- **Email analysis.** Paste emails or raw headers, upload `.eml` files, inspect findings and reported authentication, and reopen owner-scoped saved reports from the dashboard. [Usage and limits](docs/email-analysis.md).

### Web app

- **Landing page** with live link checker, product walkthrough, sector coverage, sample report, pricing and FAQ.
- **Sign-up and login** with a hand-off flow: a link pasted on the landing page is scanned automatically after sign-in.
- **Dashboard** with Overview, Scans, Messages, Email analysis, Certificates, Threats, Reports, Threat ledger and account Settings. Message links and HTTPS certificate inspections use the URL scanner. Certificates shows saved TLS evidence, and Threats connects investigations by exact shared domains and leaf fingerprints. Scheduled monitoring and validated campaign attribution remain future work.
- **Light and dark themes**, a responsive dashboard from phones to 4K displays, where the workspace scales up to stay readable, SEO metadata, Open Graph image, sitemap, robots rules and web manifest.

> Complete the [Supabase setup](docs/auth.md), including the database migration and Google provider configuration, before signing in. Notification preferences are saved; email alert delivery is not connected.

### What is in this repository

| Part | Path | Stack | Purpose |
| --- | --- | --- | --- |
| **Web app** | [`webassure/`](webassure/) | Next.js 14, React 18 | Product website, sign-up and login, and the user dashboard |
| **Investigation backend** | [`backend/`](backend/) | Python 3.11+, FastAPI, Supabase | Runs URL investigations and stores reports under each user's account |
| **Tests** | [`tests/`](tests/) | `unittest`, Playwright | Pipeline, provider, explanation and dashboard tests |
| **Docs** | [`docs/`](docs/) | Markdown | Problem statement and detailed backend guide |

### Status and limitations

WebAssure is a hackathon-stage project. To be clear about what is real today:

| Area | Status |
| --- | --- |
| URL investigation, redirects, TLS verification, risk classification | Working (backend) |
| Safe Browsing reputation lookup | Working with an API key |
| Local and Gemini explanations | Working |
| Web app UI: landing, auth, dashboard | Connected to the investigation backend |
| Web app ↔ backend integration | Authenticated proxy and per-user Supabase report storage |
| Real authentication and user accounts | Supabase Google/email, recovery, profile and Storage integration; project setup required |
| Static HTML inspection (bounded, no scripts executed) | Working |
| Leaf certificate key strength and signature hash checks | Implemented with saved certificate details and on-demand HTTPS inspection |
| Certificate Transparency, revocation and scheduled monitoring | Planned |
| Scam-message analysis | Working |
| Email analysis (paste, headers, `.eml`) | Working |
| Gmail inbox protection and fraud alerts | Working with OAuth setup; public access requires Google verification |
| Blockchain threat ledger | Live on Ethereum Sepolia with MetaMask, plus a local EVM for development; receipt export/import and independent integrity verification ([setup](docs/ledger.md)) |

The backend is a local MVP. Run a single worker. Before any public deployment, add per-user rate limits, data retention controls, network egress restrictions and a durable job queue with hard deadlines.

## Demo

<a href="https://youtu.be/buhY1Fo2WFw"><img src="https://img.youtube.com/vi/buhY1Fo2WFw/maxresdefault.jpg" alt="Watch the WebAssure demo video on YouTube" width="100%" /></a>

| | |
| --- | --- |
| **Live demo** | <https://web-assure.vercel.app> |
| **Demo video** | [Watch on YouTube](https://youtu.be/buhY1Fo2WFw) |
| **Pitch deck** | [View and download](https://web-assure.vercel.app/download) (PPT and PDF) |
| **Run it locally** | Web app at <http://localhost:3000>, API docs at <http://127.0.0.1:8000/docs> (see [Setup and run](#setup-and-run)) |

## Tech stack

| Layer | Technology |
| --- | --- |
| **Web app** | Next.js 14 (App Router), React 18, CSS (custom design system, no UI kit) |
| **Auth and data** | Supabase Auth (Google and email), Supabase Postgres with row-level security, Supabase Storage |
| **Backend** | Python 3.11+, FastAPI, Uvicorn |
| **Detection** | DNS, redirect and TLS inspection, `tldextract`, `confusable-homoglyphs`, `idna`, `cryptography`, Google Safe Browsing |
| **Machine learning** | scikit-learn message classifier (Logistic Regression), trained on the UCI SMS Spam Collection |
| **AI explanations** | Google Gemini (optional, schema-validated) |
| **Threat ledger** | Solidity contract, `ethers`, local EVM (Ganache), Sepolia deployment tooling |
| **Testing** | Python `unittest`, browser tests on Microsoft Edge |

## Architecture

```mermaid
flowchart LR
  Browser[Next.js dashboard] -->|Sign-in and session| Auth[Supabase Auth]
  Browser -->|User bearer token| Proxy[Next.js API proxy]
  Proxy --> API[FastAPI investigation service]
  API -->|Verify user token| Auth
  API -->|User token and owner filter| DB[Supabase Postgres with RLS]
  Browser -->|Owner-only uploads| Photos[Supabase avatar Storage]
```

### Project structure

```text
.
├── backend/                 FastAPI investigation service
│   ├── main.py              API routes and app setup
│   ├── investigation.py     Investigation pipeline and classification
│   ├── network.py           DNS, redirect and TLS inspection
│   ├── threat_intelligence.py  Safe Browsing provider
│   ├── explanation.py       Local rule-based explanations
│   ├── gemini.py            Optional Gemini explanations
│   └── supabase.py          Verified sessions and owner-scoped Supabase storage
├── webassure/               Next.js web app
│   ├── public/              Favicon, icons, Open Graph image, manifest
│   └── src/
│       ├── app/             Routes, layout, metadata, robots, sitemap
│       ├── components/      Landing page sections and shared UI
│       ├── views/           Landing, auth and dashboard pages
│       ├── lib/             Supabase auth, API client and dashboard data
│       └── styles/          Design system and page styles
├── tests/                   Backend and dashboard tests
├── docs/                    Problem statement and backend guide
├── requirements.txt
├── requirements-dev.txt
└── .env.example
```

## Setup and run

### Prerequisites

- **Node.js 22+** and npm, for the web app and current Supabase client
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

- Dashboard: <http://localhost:3000/dashboard>
- Interactive API docs: <http://127.0.0.1:8000/docs>

### 2. Web app

```bash
cd webassure
npm install
npm run dev
```

Open <http://localhost:3000/login>. The demo bypass is removed. Apply the [Supabase migration and environment setup](docs/auth.md) first.

Production build:

```bash
npm run build
npm start
```

### Configuration

Copy the template and fill in the keys you need. `.env` is git-ignored.

```bash
cp .env.example .env        # Windows: Copy-Item .env.example .env
```

| Variable | Required | Description |
| --- | --- | --- |
| `GOOGLE_SAFE_BROWSING_API_KEY` | Optional | Enables reputation lookups. Without it, the check is reported as unavailable. |
| `GEMINI_API_KEY` | Optional | Enables on-demand Gemini explanations. Local explanations work without it. |
| `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REDIRECT_URI` | Optional | Enable Gmail inbox protection. Keep them on the backend only. |
| `GEMINI_MODEL` | Optional | Gemini model name (default `gemini-3.8-flash`). |
| `SUPABASE_URL` | Required, backend | Supabase project URL. |
| `SUPABASE_PUBLISHABLE_KEY` | Required, backend | Publishable key; requests also require the signed-in user's token. |
| `NEXT_PUBLIC_SUPABASE_URL` | Required, frontend | Set in `webassure/.env.local` or the hosting build environment. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Required, frontend | Browser publishable key. |

Never commit `.env` or `.env.local`. Only publishable Supabase keys belong in frontend variables; keep provider secrets and service-role keys out of browser code.

### API

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/investigations` | Run an investigation. Body: `{"url": "https://example.com"}`. Returns the completed report (`201`). |
| `GET` | `/api/investigations/{id}` | Retrieve a saved report. |
| `GET` | `/api/investigations?limit=30&offset=0` | Recent report summaries, newest first (max `limit` 100). |
| `POST` | `/api/investigations/{id}/explanation` | Generate an explanation. Local by default; add `?provider=gemini` for Gemini. |
| `POST` | `/api/analyze-message` | Analyze an SMS or message body using the text classifier and heuristic indicators. |
| `GET` | `/health` | Liveness check. |

Example:

```bash
curl -X POST http://127.0.0.1:8000/api/investigations \
  -H "Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

Full behaviour, error codes and provider validation are documented in [`docs/backend.md`](docs/backend.md).

### Message analysis model

Install the updated requirements, download the [UCI SMS Spam Collection](https://archive.ics.uci.edu/dataset/228/sms%2Bspam%2Bcollection) dataset, and extract its `SMSSpamCollection` file. Train with:

```powershell
.venv\Scripts\python -m backend.train_message_model path\to\SMSSpamCollection
```

The command compares Logistic Regression with Multinomial Naive Bayes on a stratified holdout set, prints real evaluation metrics, and saves the Logistic Regression artifact under `backend/models/` and metrics under ignored `data/`. The dataset is English SMS spam/ham, so it is not a comprehensive scam or phishing corpus. See [`docs/backend.md`](docs/backend.md#message-spam-scam-analysis) for the API schema and limitations.

### Testing

```bash
# Install test dependencies
python -m pip install -r requirements-dev.txt

# Unit and pipeline tests (mocked network and providers)
python -m unittest discover -s tests -v

# Dashboard browser tests (uses installed Microsoft Edge, no outbound scans)
python -m unittest discover -s tests -p webassure_browser.py -v

# Live Safe Browsing validation (requires a configured key)
python -m backend.validate_threat_intelligence
```

Tests use mocked responses and do not measure real-world detection accuracy.

## Disclosures

**Open-source libraries.** Web app: Next.js, React, `@supabase/supabase-js`, `ethers`, `jspdf`, `html-to-image`; dev tooling: `solc`, `ganache`. Backend: FastAPI, Uvicorn, `python-dotenv`, `tldextract`, `confusable-homoglyphs`, `idna`, scikit-learn, `joblib`, `cryptography`. All are used under their own open-source licences.

**External services and data.** Supabase (auth, database, storage), Google Safe Browsing (optional reputation lookups), Google Gemini (optional explanations), and the [UCI SMS Spam Collection](https://archive.ics.uci.edu/dataset/228/sms%2Bspam%2Bcollection) dataset for training the message classifier.

**Templates and assets.** No website or UI template was used; the interface is custom-built. Fonts: Hanken Grotesk, Outfit, Inter and Archivo (Google Fonts, open licence). Brand logos in the UI (Apple, Android, Chrome, Firefox, Brave, Amazon, Infosys, Shopify and others) come from [Simple Icons](https://simpleicons.org/) (CC0); the SBI mark is a hand-drawn approximation. HackMatrix, ACM, MLH, Adamas University and RICE Adamas Group logos in this README are from [hackmatrix.codes](https://hackmatrix.codes/), shown with the Geist Pixel font.

**AI tools.** Claude Code (Anthropic) assisted with frontend design and implementation of the web app, the README and the page assets. Google Gemini is part of the product itself, as the optional explanation provider; it cannot change a verdict. All AI-assisted work was reviewed by the team.

## Track

**AI-Powered Web Threat Detection & Digital Trust Intelligence**, at [HackMatrix 2026](https://hackmatrix.codes/).

WebAssure was built for **[HackMatrix 2026](https://hackmatrix.codes/)**, the AI & student hackathon organised by the [ACM Student Chapter](https://acm.cycoders.in) at [Adamas University](https://www.aucse.in), Kolkata, with RICE Adamas Group, and co-powered by [ACM](https://acm.org) and [Major League Hacking](https://mlh.io/).

| | |
| --- | --- |
| **Online sprint** | 48 hours, 7–10 November 2026 |
| **Hack Day** | 12 hours offline, 14 November 2026, Adamas University, Kolkata |
| **Challenge** | AI-Powered Web Threat Detection & Digital Trust Intelligence |

## Team

<div align="center">

WebAssure is built by **Fantastic 4**.

<br />

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/team-dark.png" />
  <img src="docs/assets/team-light.png" alt="Fantastic 4: Souradeep Pradhan, Madhushree Dasgupta, Aniruddha Das and Sattwik Das" width="720" />
</picture>

</div>

## Security and privacy

- Submitted URLs, including query strings, are stored in the report database. Protect it accordingly.
- When Safe Browsing is enabled, submitted URLs are sent to Google. Obtain user consent before enabling it for others.
- Gemini receives only hostnames, finding descriptions and selected evidence, never URL paths, queries or raw headers.
- API keys are read from `.env` and are never included in reports or error messages.

Found a security issue? Please report it privately to the maintainers rather than opening a public issue.

## License

Copyright 2026 the WebAssure contributors.

Licensed under the [Apache License, Version 2.0](LICENSE). You may not use this project except in compliance with the License. Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
