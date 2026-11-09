# HackMatrix 2026 submission

Everything the submission form asks for, in one place. Fields marked **To add** still need a link from the team before submitting.

| Field | Value | Status |
| --- | --- | --- |
| **Project name** | WebAssure | Ready |
| **GitHub repository** | <https://github.com/pradhan-not-found/Hackmatrix-26-> | Ready (confirm the repo is public) |
| **Pitch deck link** | _Google Drive, Google Slides or Canva link, viewable by anyone_ | To add |
| **Live website / demo** | _Deployed URL_. If it is not hosted, the [README](../README.md#setup-and-run) has full run instructions | To add |
| **Demo video** | _YouTube or Google Drive link, 3 minutes or less_ | To add |
| **Write-up / documentation** | [PDF](writeup/WebAssure-Writeup.pdf) and [LaTeX source](writeup/WebAssure-Writeup.tex). Upload the PDF to Google Drive, or paste it into a Google Doc, then share the public link here | Written, needs public link |
| **Short description** | See below (under 1,000 characters) | Ready |

---

## What is implemented

| Area | What works today | Status |
| --- | --- | --- |
| **URL investigation** | Public-DNS validation, re-checked redirects, verified TLS, bounded static HTML reading, look-alike domains and a deterministic verdict with evidence | Working |
| **Investigation report** | Verdict, findings, individual checks, connection and redirect tables, source evidence and JSON export | Working |
| **Certificates** | Saved TLS evidence and on-demand HTTPS inspection, including key strength and signature hash | Working |
| **Reputation** | Google Safe Browsing lookup. A failed lookup is reported as unavailable, never as clean | Working with an API key |
| **Scam messages** | Trained scikit-learn classifier plus explainable indicators, without opening extracted links | Working |
| **Email analysis** | Pasted emails, raw headers and `.eml` uploads, with sender, SPF, DKIM and DMARC evidence, link and attachment checks, and a saved private history | Working |
| **Gmail inbox protection** | Read-only Gmail connection in Settings, inbox screening and in-app fraud alerts | Working with OAuth setup; public access requires Google verification |
| **Threats** | Investigations connected by exact shared domains and certificate fingerprints | Working |
| **Threat ledger** | Salted report fingerprints registered through MetaMask, with receipt export, import and independent verification | Live on Ethereum Sepolia |
| **AI explanations** | Built-in rule-based explanations, plus optional schema-validated Gemini explanations for URL reports that cannot change the verdict | Working; Gemini needs an API key |
| **Accounts and privacy** | Google and email sign-in, password recovery, profile, verified sessions and owner-only storage | Working with Supabase setup |
| **Tests** | 169 backend and 28 web app automated tests. They use mocked network calls and do not measure real-world detection accuracy | Passing |

Not implemented yet: Certificate Transparency, revocation and scheduled monitoring, validated campaign attribution, and production hardening (per-user rate limits, retention controls, egress restrictions and a durable job queue).

---

## Project name

**WebAssure**

Up to 200 characters. Suggested subtitle if the form allows it:

> WebAssure: know your website before you trust it. AI threat detection for links, emails, messages and certificates, explained in plain language.

## GitHub repository

<https://github.com/pradhan-not-found/Hackmatrix-26->

The repository contains the full source: the Next.js web app (`webassure/`), the FastAPI investigation backend (`backend/`), tests (`tests/`) and documentation (`docs/`). Make sure its visibility is **Public** before submitting.

## Pitch deck link

**To add.** The deck now covers email analysis, Gmail inbox protection and the live Sepolia registry. Export it from the web app's `/download` page (PPT or PDF), upload it to Google Drive, Google Slides or Canva, and set sharing to *Anyone with the link can view*.

## Live website / demo link

**To add.** If the project is deployed, paste its URL here; this link is shown on the public leaderboard once results are out.

If it cannot be hosted, point judges to [Setup and run](../README.md#setup-and-run) in the README, which covers the backend, the web app, configuration and tests.

## Demo video link

**To add.** A walkthrough of 3 minutes or less on YouTube (public or unlisted) or Google Drive (anyone with the link). Suggested flow:

1. Paste a suspicious link on the home page and sign in (0:00–0:30)
2. Walk through the report: verdict, evidence and plain-language explanation (0:30–1:30)
3. Analyse a scam email, check a scam SMS, then show Gmail inbox protection and its fraud alert (1:30–2:10)
4. Show certificate inspection and the on-chain threat ledger (2:10–2:45)
5. Close on the problem it solves (2:45–3:00)

## Write-up or documentation

**Written:** [PDF](writeup/WebAssure-Writeup.pdf) and [LaTeX source](writeup/WebAssure-Writeup.tex). It covers the problem, what we built, architecture, the analysis pipeline, the AI and blockchain design, security, the challenges we solved, testing and limitations.

To submit it: the form asks for a Google Doc or Notion page, so open the PDF in Google Docs or paste its text into one, set sharing to *Anyone with the link can view*, and paste that link into the form and the table above.

## Short description

What it does, how we built it and the hardest problem we solved. Up to 1,000 characters (this text is 939):

> WebAssure is an explainable AI, cybersecurity and Web3 platform that investigates suspicious URLs, emails, SMS and TLS certificates and returns evidence-based risk assessments in plain language. It detects phishing, brand impersonation, homograph domains, malicious redirect chains, credential-harvesting forms and SPF, DKIM or DMARC failures, and sends read-only Gmail fraud alerts. Built with Next.js, FastAPI, Supabase row-level security, Google Safe Browsing, a scikit-learn scam classifier and schema-validated Gemini explanations. Salted report fingerprints are registered through a Solidity smart contract on Ethereum Sepolia with MetaMask for tamper-evident, independent verification. The hardest problem was trust: inspecting hostile pages safely with SSRF-resistant DNS validation and bounded parsing, keeping verdicts deterministic so AI cannot change them, and reporting a failed check as Inconclusive, never as a clean result.

## Keywords

Explainable AI, phishing detection, digital trust intelligence, website impersonation, homograph and look-alike domain analysis, malicious redirect chains, TLS certificate validation, credential harvesting, email authentication (SPF, DKIM, DMARC), scam message classification, Google Safe Browsing, Gemini, Web3, Solidity, Ethereum Sepolia, tamper-evident reports, row-level security, SSRF protection.

## Before you submit

- [ ] Repository is public and the README renders correctly
- [ ] Pitch deck uploaded and shared as *anyone with the link can view*
- [ ] Demo video is 3 minutes or less and viewable without sign-in
- [ ] Live demo URL works in a private browser window, or run instructions are in the README
- [ ] Write-up page is shared publicly
- [ ] Disclosures in the README list every library, template and AI tool used
