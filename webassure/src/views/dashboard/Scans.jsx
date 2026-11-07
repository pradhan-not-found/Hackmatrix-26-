'use client'

import { useEffect, useMemo, useState } from 'react'
import { useDash } from './context.js'
import { Badge } from '../../components/Sections.jsx'
import { tone, verdict } from '../../lib/data.js'
import { Empty, PageHead, RiskCell, Tabs } from './ui.jsx'

function exportScan(s) {
  const data = { id: s.id, url: s.url, risk: s.risk, verdict: verdict(s.risk), category: s.category, source: s.source, findings: s.findings }
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${s.id}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Scans() {
  const { scans, focusId, clearFocus } = useDash()
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(null)
  const [reported, setReported] = useState({})

  useEffect(() => {
    if (focusId && scans.some((s) => s.id === focusId)) {
      setSelected(focusId)
      clearFocus()
    }
  }, [focusId, scans, clearFocus])

  useEffect(() => {
    if (!selected) return
    const onKey = (e) => e.key === 'Escape' && setSelected(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected])

  const counts = useMemo(() => ({
    all: scans.length,
    bad: scans.filter((s) => tone(s.risk) === 'bad').length,
    warn: scans.filter((s) => tone(s.risk) === 'warn').length,
    ok: scans.filter((s) => tone(s.risk) === 'ok').length,
  }), [scans])

  const rows = scans.filter((s) => (filter === 'all' || tone(s.risk) === filter) && s.url.toLowerCase().includes(q.toLowerCase()))
  const sel = scans.find((s) => s.id === selected)

  return (
    <>
      <PageHead title="Scans" sub="Every URL, domain and message checked in this workspace." />

      <div className="card panel panel--flush">
        <div className="toolbar">
          <Tabs value={filter} onChange={setFilter} options={[['all', 'All', counts.all], ['bad', 'High risk', counts.bad], ['warn', 'Suspicious', counts.warn], ['ok', 'Low risk', counts.ok]]} />
          <input className="input-sm" placeholder="Filter by URL" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter scans by URL" />
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table className="table table--click">
              <thead><tr><th>URL</th><th>Category</th><th>Source</th><th>Risk</th><th>Verdict</th><th className="t-right">When</th></tr></thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} onClick={() => setSelected(s.id)} data-fresh={s.fresh || undefined} aria-selected={selected === s.id}>
                    <td className="table__url">{s.url}</td>
                    <td className="grey">{s.category}</td>
                    <td className="grey">{s.source}</td>
                    <td><RiskCell risk={s.risk} tone={tone(s.risk)} /></td>
                    <td><Badge tone={tone(s.risk)}>{verdict(s.risk)}</Badge></td>
                    <td className="grey t-right">{s.when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No scans match" text="Try a different filter, or scan a new URL from the bar above." />
        )}
      </div>

      {sel && (
        <>
          <button className="drawer-scrim" onClick={() => setSelected(null)} aria-label="Close details" />
          <aside className="drawer" aria-label="Scan details">
            <div className="drawer__head">
              <div>
                <p className="caption grey">{sel.id} · {sel.source}</p>
                <h2 className="drawer__title">{sel.url}</h2>
              </div>
              <button className="icon-btn" onClick={() => setSelected(null)} aria-label="Close">×</button>
            </div>
            <div className="drawer__score">
              <span className="drawer__n">{sel.risk}</span>
              <Badge tone={tone(sel.risk)}>{verdict(sel.risk)}</Badge>
            </div>
            <h3 className="drawer__h">Indicators</h3>
            <ul className="drawer__list">
              {sel.findings.map((f) => <li key={f}>{f}</li>)}
            </ul>
            <div className="drawer__actions">
              <button className="btn btn--ink" disabled={reported[sel.id]} onClick={() => setReported((r) => ({ ...r, [sel.id]: true }))}>
                {reported[sel.id] ? 'Submitted to ledger' : 'Report to ledger'}
              </button>
              <button className="btn btn--ghost" onClick={() => exportScan(sel)}>Export JSON</button>
            </div>
          </aside>
        </>
      )}
    </>
  )
}
