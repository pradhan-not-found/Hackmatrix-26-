'use client'

import { useState } from 'react'
import { Badge } from '../../components/Sections.jsx'
import { CERTS } from '../../lib/data.js'
import { Kpi, PageHead } from './ui.jsx'
import { CertificatesIcon } from './NavIcons.jsx'

const STATUS = { ok: 'Valid', warn: 'Expiring soon', bad: 'Needs attention' }
const LIFETIME = 365 // days, used to draw the remaining-validity bar

function Lock() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </svg>
  )
}

function CertRow({ c }) {
  const pct = c.days == null ? 0 : Math.max(4, Math.min(100, (c.days / LIFETIME) * 100))
  const tone = c.pending ? 'warn' : c.status
  return (
    <li className="cr">
      <span className={`cr__icon cr__icon--${tone}`}><Lock /></span>
      <div className="cr__main">
        <p className="cr__host">{c.host}</p>
        <p className="cr__issuer">{c.issuer}</p>
      </div>
      <div className="cr__checks">
        <span className={`cr__check${c.key === 'RSA 1024' ? ' cr__check--bad' : ''}`}>
          <span className="cr__k">Key</span>{c.key}
        </span>
        <span className={`cr__check${c.ct === false ? ' cr__check--bad' : ''}`}>
          <span className="cr__k">CT logs</span>{c.ct == null ? '—' : c.ct ? 'Logged' : 'Missing'}
        </span>
      </div>
      <div className="cr__expiry">
        <div className="cr__exp-top">
          <span>{c.expires}</span>
          <span className="cr__days">{c.days == null ? 'Pending' : `${c.days} days left`}</span>
        </div>
        <span className="cr__bar"><span className={`cr__fill cr__fill--${tone}`} style={{ width: `${pct}%` }} /></span>
      </div>
      <div className="cr__status">
        <Badge tone={tone}>{c.pending ? 'Queued' : STATUS[c.status]}</Badge>
      </div>
    </li>
  )
}

export default function Certificates() {
  const [certs, setCerts] = useState(CERTS)
  const [host, setHost] = useState('')
  const [err, setErr] = useState('')

  const add = (e) => {
    e.preventDefault()
    const h = host.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0]
    if (!/^[a-z0-9*.-]+\.[a-z]{2,}$/.test(h)) return setErr('Enter a domain such as shop.example.com')
    if (certs.some((c) => c.host === h)) return setErr('That domain is already monitored.')
    setErr('')
    setCerts((c) => [{ host: h, issuer: 'Awaiting first check', expires: '—', days: null, key: '—', ct: null, status: 'warn', pending: true }, ...c])
    setHost('')
  }

  const count = (s) => certs.filter((c) => !c.pending && c.status === s).length

  return (
    <>
      <PageHead title="Certificates" />

      <section className="kpis">
        <Kpi label="Monitored domains" value={certs.length} delta="TLS certificates watched" />
        <Kpi label="Valid" value={count('ok')} delta="Trusted chain, logged in CT" />
        <Kpi label="Expiring soon" value={count('warn')} delta="Within 14 days" />
        <Kpi label="Needs attention" value={count('bad')} delta="Weak key, unknown issuer or missing CT" />
      </section>

      <form className="card panel cmon" onSubmit={add}>
        <span className="cmon__icon"><CertificatesIcon /></span>
        <div className="cmon__txt">
          <p className="panel__title">Monitor a domain</p>
          <p className="caption grey">Get alerts on expiry, weak keys, unknown issuers and missing Certificate Transparency entries.</p>
        </div>
        <div className="cmon__field">
          <input className="input-sm" placeholder="shop.example.com" value={host} onChange={(e) => setHost(e.target.value)} aria-label="Domain to monitor" />
          <button className="btn btn--ink" type="submit">Add domain</button>
        </div>
        {err && <p className="dash__err cmon__err" role="alert">{err}</p>}
      </form>

      <section className="card panel panel--flush">
        <div className="panel__head cl__head">
          <h2 className="panel__title">TLS certificates</h2>
          <span className="caption grey">Preview data · live TLS results appear in each scan report</span>
        </div>
        <ul className="cl">
          {certs.map((c) => <CertRow key={c.host} c={c} />)}
        </ul>
      </section>
    </>
  )
}
