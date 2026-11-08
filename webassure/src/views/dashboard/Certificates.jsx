'use client'

import { useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/Sections.jsx'
import { Kpi, PageHead, Empty } from './ui.jsx'
import { useDash } from './context.js'
import { certificateRows } from '../../lib/certificates.mjs'
import { formatDate } from '../../lib/investigations.js'
import ReportDetails from './ReportDetails.jsx'
import SiteIcon from '../../components/SiteIcon.jsx'

const issuerName = (issuer) => typeof issuer === 'string' ? issuer : Object.values(issuer || {}).join(', ') || 'Not collected'

function Certificate({ item, onOpen }) {
  const { tls, cert } = item
  const key = cert.public_key
  const names = cert.subject_alt_names || (tls.subject_alt_names || []).map(([type, value]) => ({ type, value }))
  return <article className="card panel cert-record">
    <div className="cert-record-head">
      <div className="cert-record-title">
        <SiteIcon url={item.host} size={22} />
        <div>
          <h2 className="panel__title">{item.host}</h2>
          <p className="caption grey">Checked {formatDate(item.checkedAt)}</p>
        </div>
      </div>
      <Badge tone={item.status}>{item.label}</Badge>
    </div>
    {item.error && <p className="dash__err">{item.error}</p>}
    <dl className="cert-record-grid">
      <div><dt>Issuer</dt><dd>{issuerName(cert.issuer || tls.issuer)}</dd></div>
      <div><dt>TLS connection</dt><dd>{tls.protocol || 'Not collected'}{tls.verified && ' · Hostname and system trust verified at scan'}</dd></div>
      <div><dt>Valid from</dt><dd>{formatDate(cert.not_before || tls.not_before)}</dd></div>
      <div><dt>Expires</dt><dd>{formatDate(cert.not_after || tls.not_after)}{item.days !== null && ` · ${item.days <= 0 ? 'Expired' : `${item.days} days left`}`}</dd></div>
      <div><dt>Public key</dt><dd>{key ? `${key.algorithm}${key.bits ? ` ${key.bits} bits` : ''}${key.curve ? ` (${key.curve})` : ''} · ${key.status}` : 'Not assessed in this report'}</dd></div>
      <div><dt>Certificate signature</dt><dd>{cert.signature ? `${cert.signature.algorithm || cert.signature.oid}${cert.signature.hash ? ` / ${cert.signature.hash}` : ''} · ${cert.signature.status}` : 'Not assessed in this report'}</dd></div>
    </dl>
    <details className="cert-record-details"><summary>Certificate identity and evidence</summary><dl className="cert-record-grid">
      <div><dt>Subject</dt><dd>{cert.subject || 'Not collected'}</dd></div>
      <div><dt>Subject Alternative Names</dt><dd>{names.length ? names.map((name) => `${name.type}: ${name.value}`).join(', ') : 'Not collected'}</dd></div>
      <div><dt>SHA-256 fingerprint</dt><dd><code>{cert.sha256_fingerprint || 'Not collected'}</code></dd></div>
      <div><dt>Negotiated cipher</dt><dd>{tls.cipher || 'Not collected'}</dd></div>
    </dl></details>
    <div className="cert-record-foot"><p className="caption grey">Saved snapshot. Revocation, CT and full-chain strength are not assessed. HTTPS does not establish website legitimacy.</p><button className="btn btn--ghost" onClick={() => onOpen(item.reportId)}>View scan report</button></div>
  </article>
}

export default function Certificates() {
  const { scans, getReport, runInvestigation, scanLoading, historyLoading, historyError, refreshHistory, total, loadMore } = useDash()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [host, setHost] = useState('')
  const [openReport, setOpenReport] = useState(null)
  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setReports([])
    const collect = async () => {
      const results = []
      let failed = 0
      // Bound report retrieval; older history is fetched explicitly by the user.
      for (let offset = 0; offset < scans.length; offset += 4) {
        const batch = await Promise.allSettled(scans.slice(offset, offset + 4).map((scan) => getReport(scan.id)))
        if (!active) return
        for (const result of batch) result.status === 'fulfilled' ? results.push(result.value) : failed++
      }
      if (active) { setReports(results); setLoading(false); if (failed) setError(`${failed} saved report(s) could not be loaded. The list and counts are incomplete.`) }
    }
    collect()
    return () => { active = false }
  }, [scans, getReport, attempt])
  const rows = useMemo(() => certificateRows(reports), [reports])
  const count = (status) => rows.filter((row) => row.status === status).length
  const inspect = async (event) => {
    event.preventDefault()
    if (scanLoading) return
    setError('')
    try {
      const url = new URL(host.includes('://') ? host.trim() : `https://${host.trim()}`)
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Enter an HTTPS URL or domain without credentials.')
      const result = await runInvestigation(url.href, { navigate: false })
      if (result) setHost('')
    } catch (failure) { setError(failure.message) }
  }
  return <>
    <PageHead title="Certificates" />
    <section className="kpis"><Kpi label="Domains in loaded reports" value={loading ? '…' : rows.length} delta="Latest saved observation per host" /><Kpi label="Verified at scan" value={loading ? '…' : count('ok')} delta="Supported leaf crypto checks passed" /><Kpi label="Needs review" value={loading ? '…' : count('warn')} delta="Expiring or checks incomplete" /><Kpi label="Needs attention" value={loading ? '…' : count('bad')} delta="Verification, validity or weak crypto" /></section>
    <form className="card panel cmon" onSubmit={inspect}><div className="cmon__txt"><p className="panel__title">Inspect a certificate</p><p className="caption grey">Run a new HTTPS investigation and save its certificate evidence.</p></div><div className="cmon__field"><input className="input-sm" value={host} onChange={(event) => setHost(event.target.value)} placeholder="shop.example.com" aria-label="Domain or HTTPS URL to inspect" required /><button className="btn btn--ink" disabled={scanLoading}>{scanLoading ? 'Inspecting…' : 'Inspect certificate'}</button></div></form>
    {(error || historyError) && <div className="card panel" role="alert"><p>{error || historyError}</p><button className="btn btn--ghost" disabled={loading} onClick={() => historyError ? refreshHistory() : setAttempt((value) => value + 1)}>Retry certificate reports</button></div>}
    <p className="caption grey">Using {reports.length} of {total} saved investigations. Results are snapshots; older reports may require a new scan for cryptographic details.</p>
    {loading || historyLoading ? <p role="status">Loading certificate evidence…</p> : rows.length ? <div className="cert-records">{rows.map((item) => <Certificate key={item.host} item={item} onOpen={setOpenReport} />)}</div> : !error && !historyError && <Empty title="No certificate evidence yet" text="Inspect an HTTPS domain or load more saved investigations." />}
    {scans.length < total && <button className="btn btn--ghost" disabled={historyLoading || loading} onClick={loadMore}>Load more investigations</button>}
    {openReport && <ReportDetails id={openReport} onClose={() => setOpenReport(null)} />}
  </>
}
