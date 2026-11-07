'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertIcon, ArrowIcon, CheckIcon } from './Icons.jsx'

export function Badge({ tone, children }) {
  return (
    <span className={`badge badge--${tone}`}>
      <span className="badge__dot" aria-hidden="true" />
      {children}
    </span>
  )
}

export function ScoreRing({ value, label, size = 132 }) {
  const r = 52
  const c = 2 * Math.PI * r
  const tone = value >= 55 ? 'var(--st-bad)' : value >= 25 ? 'var(--st-warn)' : 'var(--st-ok)'
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--track)" strokeWidth="8" />
        <circle
          cx="60" cy="60" r={r} fill="none" stroke={tone} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} transform="rotate(-90 60 60)"
        />
      </svg>
      <div className="ring__in">
        <span className="ring__n">{value}</span>
        <span className="ring__l">{label}</span>
      </div>
    </div>
  )
}

/* ---------- Report preview ---------- */
const FINDINGS = [
  ['bad', 'Brand impersonation', 'Page imitates the SBI login screen (visual similarity 94%).'],
  ['bad', 'Certificate anomaly', 'Certificate issued 2 days ago and absent from CT logs.'],
  ['warn', 'Risky domain', '.xyz domain registered 3 days ago, privacy-protected owner.'],
  ['ok', 'No malware', 'No malicious scripts or drive-by downloads detected.'],
]

export function Report() {
  return (
    <section className="section wrap report" id="report">
      <div className="report__copy reveal">
        <p className="eyebrow">The report</p>
        <h2 className="t-statement">Evidence, not guesses.</h2>
        <p className="t-lead grey">
          Rather than a bare safe-or-malicious label, every check comes back as an assessment you can read,
          verify and share.
        </p>
        <ul className="ticks">
          <li><CheckIcon /> Every indicator explained in plain language</li>
          <li><CheckIcon /> Certificate chain and CT-log evidence attached</li>
          <li><CheckIcon /> Clear recommendation: avoid, review or proceed</li>
          <li><CheckIcon /> One-click report to the shared threat ledger</li>
        </ul>
      </div>

      <div className="card report__card reveal" aria-label="Sample WebAssure report">
        <div className="report__top">
          <div>
            <p className="caption grey">Scanned URL</p>
            <p className="report__url">secure-sbi-kyc-update.xyz/login</p>
            <p className="caption grey">Scanned 12 seconds ago · 4.2s</p>
          </div>
          <ScoreRing value={82} label="High risk" size={104} />
        </div>
        <ul className="findings">
          {FINDINGS.map(([tone, title, text]) => (
            <li key={title} className="finding">
              <span className={`finding__icon finding__icon--${tone}`}>
                {tone === 'ok' ? <CheckIcon /> : <AlertIcon />}
              </span>
              <div>
                <p className="finding__t">{title}</p>
                <p className="caption grey">{text}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="report__rec">
          <Badge tone="bad">Avoid</Badge>
          <span className="caption">Do not enter credentials. Report sent to the threat ledger.</span>
        </div>
      </div>
    </section>
  )
}

/* ---------- FAQ ---------- */
const FAQS = [
  ['What can I submit?', 'Any URL, domain, email or message. WebAssure extracts the links and checks each one.'],
  ['Do I have to open the suspicious site?', 'No. Pages are fetched in an isolated sandbox on our side, so nothing runs on your device.'],
  ['How is the risk score calculated?', 'Four engines (AI content analysis, certificate validation, site-security scanning and reputation data) each contribute weighted indicators. The report shows every one.'],
  ['What does the blockchain part do?', 'Confirmed threats are anchored on-chain so reports cannot be quietly altered or removed, and anyone can verify them.'],
  ['Is there an API?', 'Yes. Security teams can submit URLs and pull reports programmatically from the dashboard.'],
]

export function Faq() {
  const [open, setOpen] = useState(0)
  return (
    <section className="section wrap faq" id="faq">
      <div className="head reveal">
        <p className="eyebrow">FAQ</p>
        <h2 className="t-statement">Questions, answered.</h2>
      </div>
      <div className="faq__list">
        {FAQS.map(([q, a], i) => (
          <div key={q} className="faq__item" data-open={open === i || undefined}>
            <button className="faq__q" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
              <span>{q}</span>
              <span className="faq__plus" aria-hidden="true" />
            </button>
            <div className="faq__a">
              <p>{a}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ---------- CTA ---------- */
export function Cta() {
  return (
    <section className="section wrap" id="contact">
      <div className="cta reveal">
        <h2 className="t-display">Know your website before you trust it.</h2>
        <p className="t-lead grey">Free for individuals. Built for teams.</p>
        <div className="cta__btns">
          <Link href="/signup" className="btn btn--ink btn--lg">Get started <ArrowIcon /></Link>
          <a href="#top" className="btn btn--ghost btn--lg">Check a link</a>
        </div>
      </div>
    </section>
  )
}
