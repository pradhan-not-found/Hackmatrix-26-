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

## Project name

**WebAssure**

Up to 200 characters. Suggested subtitle if the form allows it:

> WebAssure: know your website before you trust it. AI threat detection for links, emails, messages and certificates, explained in plain language.

## GitHub repository

<https://github.com/pradhan-not-found/Hackmatrix-26->

The repository contains the full source: the Next.js web app (`webassure/`), the FastAPI investigation backend (`backend/`), tests (`tests/`) and documentation (`docs/`). Make sure its visibility is **Public** before submitting.

## Pitch deck link

**To add.** Export the deck from the web app's `/download` page (PPT or PDF), upload it to Google Drive, Google Slides or Canva, and set sharing to *Anyone with the link can view*.

## Live website / demo link

**To add.** If the project is deployed, paste its URL here; this link is shown on the public leaderboard once results are out.

If it cannot be hosted, point judges to [Setup and run](../README.md#setup-and-run) in the README, which covers the backend, the web app, configuration and tests.

## Demo video link

**To add.** A walkthrough of 3 minutes or less on YouTube (public or unlisted) or Google Drive (anyone with the link). Suggested flow:

1. Paste a suspicious link on the home page and sign in (0:00–0:30)
2. Walk through the report: verdict, evidence and plain-language explanation (0:30–1:30)
3. Check a scam SMS, then show Gmail inbox protection and its fraud alert (1:30–2:10)
4. Show certificate inspection and the on-chain threat ledger (2:10–2:45)
5. Close on the problem it solves (2:45–3:00)

## Write-up or documentation

**Written:** [PDF](writeup/WebAssure-Writeup.pdf) and [LaTeX source](writeup/WebAssure-Writeup.tex). It covers the problem, what we built, architecture, the analysis pipeline, the AI and blockchain design, security, the challenges we solved, testing and limitations.

To submit it: the form asks for a Google Doc or Notion page, so open the PDF in Google Docs or paste its text into one, set sharing to *Anyone with the link can view*, and paste that link into the form and the table above.

## Short description

Up to 1,000 characters (this text is 916):

> WebAssure checks suspicious links, emails, messages and certificates like a security analyst and explains the result in plain language. A FastAPI backend inspects URLs safely with public-DNS validation, re-checked redirects, bounded HTML reading and verified TLS, then combines Google Safe Browsing, look-alike detection and certificate analysis into a deterministic verdict with evidence. Connected Gmail inboxes are screened for fraud without opening any link, and likely fraud triggers an in-app alert. Scikit-learn analyses scam messages, and Gemini can explain findings without changing the verdict. Salted report fingerprints can be registered on Ethereum Sepolia and verified independently. Each user's data stays private behind verified sessions and owner-only storage. The hardest problem was trust: a provider timeout must never look like a clean result, so every check reports its own coverage and limits.

## Before you submit

- [ ] Repository is public and the README renders correctly
- [ ] Pitch deck uploaded and shared as *anyone with the link can view*
- [ ] Demo video is 3 minutes or less and viewable without sign-in
- [ ] Live demo URL works in a private browser window, or run instructions are in the README
- [ ] Write-up page is shared publicly
- [ ] Disclosures in the README list every library, template and AI tool used
