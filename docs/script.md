# WebAssure: 3-minute demo script

## 0:00 – 0:30 · The problem

In 2025, Indians reported losing nineteen thousand eight hundred crore rupees to cyber fraud. Fake websites, scam messages and phishing emails now look exactly like the real thing. And the tools people have answer with one word, safe or malicious, with no reason why. A padlock in the browser doesn't help either. It only means the connection is encrypted, not that the site is honest.

## 0:30 – 0:45 · What we built

So we built WebAssure. It checks a link, an email, a message or a certificate the way a security analyst would, and shows you the evidence in plain language.

## 0:45 – 1:00 · Log in

This is our website. We log in with Google, and here is the dashboard. It shows our saved investigations, recent scans and how they break down by risk.

## 1:00 – 1:35 · Scan a link

Let's paste a suspicious link and scan it. WebAssure validates the domain, follows every redirect, verifies the certificate, reads the page safely and checks Google Safe Browsing.

Here is the report, with the verdict at the top. Overview shows the findings and what to do next. Checks shows every check that ran. Connection shows each redirect and its certificate. Evidence keeps the raw data. If a check fails, we say so. A failed check is never shown as a clean result.

## 1:35 – 2:00 · Messages and emails

Scams also arrive as text. On the Messages page, we paste an SMS, and our trained model flags it and explains why.

On Email analysis, we paste a suspicious email or upload the file. We see its risk score, sender authentication, links and attachments.

## 2:00 – 2:15 · Gmail protection

In Settings, we connect Gmail with read-only access. WebAssure screens the inbox and raises an alert when a likely fraud email arrives.

## 2:15 – 2:30 · Certificates and threats

Certificates shows the security details of every site we've checked. Threats connects investigations that share the same domain or certificate, so related attacks become visible.

## 2:30 – 2:50 · Threat ledger

Finally, the Threat ledger. We take a saved report, create its fingerprint and register it on Ethereum Sepolia with MetaMask. Only the fingerprint goes on-chain, and the report stays private. Anyone can later verify that it hasn't been changed.

## 2:50 – 3:00 · Close

That's WebAssure. Know your website before you trust it. Thank you.

---

# Sample inputs for the demo

Paste these into WebAssure only. Do not open the links in a browser. Emails and messages use made-up details.

## Links (dashboard scan)

| Expected result | Link |
| --- | --- |
| Confirmed Malicious | `http://testsafebrowsing.appspot.com/apiv4/ANY_PLATFORM/MALWARE/URL/` |
| Confirmed Malicious | `http://testsafebrowsing.appspot.com/apiv4/ANY_PLATFORM/SOCIAL_ENGINEERING/URL/` |
| Suspicious | `http://secure-sbi-kyc-update.xyz/login` |
| Suspicious | `https://paypa1-account-verify.com/login` |
| Low Risk | `https://github.com/` |
| Low Risk | `https://www.wikipedia.org/` |
| Inconclusive | `http://refund-help-portal.example/claim` |

The two Confirmed Malicious links are Google's official Safe Browsing test pages and are harmless.

## Emails (Email analysis, Paste email)

**Bank KYC phishing (expected: Phishing indicators)**

```text
From: SBI Account Security <alerts@secure-sbi-kyc-update.example>
Reply-To: recovery@unrelated-mailbox.example
Subject: URGENT: Your account will be blocked today
Authentication-Results: mx.example; spf=fail; dkim=fail; dmarc=fail

Dear customer, your KYC has expired and your account will be blocked within 24 hours.
Verify immediately by entering your password and OTP here: http://secure-sbi-kyc-update.example/login
Failure to act will result in permanent suspension.
```

**Fake job offer (expected: Phishing indicators)**

```text
From: HR Team <jobs@careers-offer-desk.example>
Reply-To: payments@quick-transfer.example
Subject: Congratulations! You are selected. Pay registration fee today

You have been selected for a work from home job with salary of Rs 85,000 per month.
Pay a refundable registration fee of Rs 2,500 urgently to confirm your offer letter.
Send your Aadhaar, bank details and OTP to complete verification: http://careers-offer-desk.example/pay
```

**Normal email (expected: No significant indicators)**

```text
From: Priya Sharma <priya@example.com>
Subject: Notes from today's project meeting

Hi team, I have added the notes from today's meeting to our shared folder.
Please review them before Friday. Thanks, Priya
```

## Messages (Messages page)

| Expected result | Message |
| --- | --- |
| Likely scam or spam | `Dear customer your SBI account will be blocked today. Update KYC now at http://sbi-kyc-update.example/login or call 9000000000` |
| Likely scam or spam | `Congratulations! You have won Rs 25,00,000 in a lucky draw. Click http://claim-prize.example and share your OTP to claim now.` |
| Likely scam or spam | `Your electricity connection will be disconnected tonight. Pay immediately at http://bill-update.example` |
| No strong indicators detected | `Hi, are we still meeting at 5 pm tomorrow near the library?` |
