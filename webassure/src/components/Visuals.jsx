'use client'

// Illustrated product scenes used as "imagery" in the What-we-do panel.
// Each element with .va animates in when its parent visual becomes active.

export { default as PhishingVisual } from './PhishingVisual.jsx'
export { default as CertificateVisual } from './CertificateVisual.jsx'

const CHECKS = [
  ['Content-Security-Policy', 'Missing', 'bad'],
  ['Open redirect on /go?u=', 'Exploitable', 'bad'],
  ['jQuery 1.12.4', 'Outdated', 'warn'],
  ['Admin panel exposed', 'Public', 'bad'],
  ['HSTS', 'Enabled', 'ok'],
]

export function AuditVisual() {
  return (
    <div className="vis vis--mint">
      <div className="audit va" style={{ '--d': '0ms' }}>
        <div className="audit__grade">
          <span className="audit__letter">D</span>
          <span>
            <span className="float__k">Security grade</span>
            <span className="float__v">shop.example-store.in</span>
          </span>
        </div>
        <ul className="audit__list">
          {CHECKS.map(([name, val, tone], i) => (
            <li key={name} className="va" style={{ '--d': `${120 + i * 70}ms` }}>
              <span className={`audit__dot audit__dot--${tone}`} />
              <span className="audit__name">{name}</span>
              <span className="audit__val">{val}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function LedgerVisual() {
  const blocks = [
    ['#4818', 'Anchored'],
    ['#4819', 'Anchored'],
    ['#4820', 'Pending'],
    ['#4821', 'Anchored'],
  ]
  return (
    <div className="vis vis--lilac">
      <div className="ledger">
        {blocks.map(([id, s], i) => (
          <div key={id} className="ledger__cell va" style={{ '--d': `${i * 110}ms` }}>
            <div className="block" data-hot={i === 3 || undefined}>
              <span className="block__id">Report {id}</span>
              <span className="block__s">{s}</span>
              <span className="block__hash">0x{(9137 + i * 4021).toString(16)}…{(41 + i * 17).toString(16)}e</span>
            </div>
            {i < blocks.length - 1 && <span className="ledger__link"><i /></span>}
          </div>
        ))}
      </div>
      <div className="float float--bl va" style={{ '--d': '480ms' }}>
        <span className="float__k">Community confirmations</span>
        <span className="float__v">12 of 12 verified · tamper-proof</span>
      </div>
    </div>
  )
}
