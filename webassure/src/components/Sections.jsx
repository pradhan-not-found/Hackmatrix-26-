'use client'

import { useState } from 'react'
import Link from 'next/link'
import ScrollText from './ScrollText.jsx'
import ThermalIcon from './ThermalIcon.jsx'

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
  ['bad', 'Brand impersonation', 'Copies the SBI login screen. Visual similarity 94%.'],
  ['bad', 'Certificate anomaly', 'Issued two days ago and missing from public logs.'],
  ['warn', 'New, hidden domain', 'Registered three days ago with a privacy-protected owner.'],
  ['ok', 'No malware', 'No malicious scripts or drive-by downloads found.'],
]

export function Report() {
  return (
    <section className="section wrap" id="report">
      <div className="wwd__head">
        <p className="eyebrow">The report</p>
        <ScrollText
          className="t-statement wwd__statement"
          lead="Evidence, not guesses."
          rest="Every verdict comes with the reasons behind it, written so anyone can act on it."
        />
      </div>

      <div className="rp reveal" aria-label="Sample WebAssure report">
        <div className="rp__verdict">
          <div className="rp__meta">
            <span className="rp__k">Scanned link</span>
            <span className="rp__url">secure-sbi-kyc-update.xyz/login</span>
          </div>
          <div className="rp__score">
            <span className="rp__n">82</span>
            <span className="rp__of">/ 100</span>
          </div>
          <div className="rp__meter" aria-hidden="true">
            <span className="rp__marker" style={{ left: '82%' }} />
          </div>
          <div className="rp__scale" aria-hidden="true"><span>Safe</span><span>Suspicious</span><span>High risk</span></div>
          <div className="rp__rec">
            <Badge tone="bad">Avoid</Badge>
            <span>Do not enter credentials on this page.</span>
          </div>
        </div>

        <ul className="rp__grid">
          {FINDINGS.map(([tone, title, text]) => (
            <li key={title} className="rp__item">
              <span className="rp__glow"><ThermalIcon shape={tone === 'ok' ? 'check' : 'alert'} size={56} /></span>
              <p className="rp__t">{title}</p>
              <p className="rp__d">{text}</p>
            </li>
          ))}
        </ul>
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
    <section className="section wrap mc" id="contact">
      <h2 className="mc__t reveal">Know your website before you trust it.</h2>
      <div className="mc__btns reveal">
        <Link href="/signup" className="pill-btn pill-btn--glow">Get started</Link>
        <a href="#pricing" className="pill-btn">See pricing</a>
      </div>
    </section>
  )
}
