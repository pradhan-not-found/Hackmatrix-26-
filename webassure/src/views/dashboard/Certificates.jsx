'use client'

import { useState } from 'react'
import { Badge } from '../../components/Sections.jsx'
import { CERTS } from '../../lib/data.js'
import { PageHead } from './ui.jsx'

const label = { ok: 'Valid', warn: 'Expiring', bad: 'Alert' }

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

  return (
    <>
      <PageHead title="Certificates" sub="TLS certificates monitored against Certificate Transparency logs." />

      <form className="card panel addbar" onSubmit={add}>
        <div>
          <p className="panel__title">Monitor a domain</p>
          <p className="caption grey">We alert you on expiry, weak keys, unknown issuers and missing CT entries.</p>
        </div>
        <div className="addbar__field">
          <input className="input-sm" placeholder="shop.example.com" value={host} onChange={(e) => setHost(e.target.value)} aria-label="Domain to monitor" />
          <button className="btn btn--ink" type="submit">Add</button>
        </div>
        {err && <p className="dash__err addbar__err" role="alert">{err}</p>}
      </form>

      <div className="card panel panel--flush">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Domain</th><th>Issuer</th><th>Key</th><th>CT logs</th><th>Expires</th><th>Status</th></tr></thead>
            <tbody>
              {certs.map((c) => (
                <tr key={c.host} data-fresh={c.pending || undefined}>
                  <td className="table__url">{c.host}</td>
                  <td className="grey">{c.issuer}</td>
                  <td className={c.key === 'RSA 1024' ? 'text-bad' : 'grey'}>{c.key}</td>
                  <td>{c.ct === null ? <span className="grey">—</span> : c.ct ? <span className="grey">Logged</span> : <span className="text-bad">Missing</span>}</td>
                  <td className="grey">{c.expires}{c.days !== null && <span className="table__sub caption">{c.days} days</span>}</td>
                  <td>{c.pending ? <Badge tone="warn">Queued</Badge> : <Badge tone={c.status}>{label[c.status]}</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
