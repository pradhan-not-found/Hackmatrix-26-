'use client'

import { useMemo, useState } from 'react'
import { Badge } from '../../components/Sections.jsx'
import { classificationTone, formatDate } from '../../lib/investigations.js'
import { correlateReports } from '../../lib/correlation.mjs'
import { Kpi, PageHead, Tabs, Empty } from './ui.jsx'
import { useDash } from './context.js'
import { useInvestigationReports } from './useInvestigationReports.js'
import ReportDetails from './ReportDetails.jsx'

export default function Threats() {
  const { scans, total, historyLoading, historyError, refreshHistory, loadMore } = useDash()
  const { reports, loading, error, retry } = useInvestigationReports()
  const [filter, setFilter] = useState('review')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const correlation = useMemo(() => correlateReports(reports), [reports])
  const rows = correlation.groups.filter((group) => (filter === 'all' || group.requiresReview) &&
    `${group.value} ${group.matches.map((match) => match.target).join(' ')}`.toLowerCase().includes(query.toLowerCase()))
  const pending = loading || historyLoading
  return <>
    <PageHead title="Threats" sub="Evidence-backed connections across your saved investigations." />
    <section className="kpis kpis--3"><Kpi label="Shared indicators" value={pending ? '…' : correlation.groups.length} delta="Exact domains and certificate fingerprints" /><Kpi label="Linked investigations" value={pending ? '…' : correlation.linkedReports} delta="Within loaded report history" /><Kpi label="Connections to review" value={pending ? '…' : correlation.reviewGroups} delta="Include an already flagged investigation" /></section>
    <div className="card panel correlation-scope"><strong>Shared evidence, not a campaign verdict</strong><p className="caption grey">A shared domain or certificate can be legitimate. Connections do not change the risk assessment of another report. Repeated scans of the same site are shown as repeated observations.</p><p className="caption grey">Compared {reports.length} of {total} saved investigations. Matching stays within your account and uses no AI tokens.</p></div>
    {(error || historyError) && <div className="card panel" role="alert"><p>{error || historyError}</p><button className="btn btn--ghost" disabled={pending} onClick={() => historyError ? refreshHistory() : retry()}>Retry connections</button></div>}
    <div className="correlation-toolbar"><Tabs value={filter} onChange={setFilter} options={[["review", 'Needs review', correlation.reviewGroups], ['all', 'All connections', correlation.groups.length]]} /><input className="input-sm" aria-label="Filter related indicators" placeholder="Find a domain or fingerprint" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
    {pending ? <p role="status">Comparing saved evidence…</p> : rows.length ? <div className="correlation-groups">{rows.map((group) => <article key={group.id} className="card panel correlation-group">
      <div className="correlation-group-head"><div><p className="analysis-eyebrow">{group.label}</p><h2 className={`panel__title${group.kind === 'certificate' ? ' correlation-fingerprint' : ''}`}>{group.value}</h2></div><Badge tone={group.requiresReview ? 'warn' : 'neutral'}>{group.matches.length} investigations</Badge></div>
      <p className="caption grey">{group.distinctTargets > 1 ? `${group.distinctTargets} submitted hosts share this indicator.` : 'Repeated observations of the same submitted host.'}{group.kind === 'certificate' && ' The full SHA-256 fingerprint matches; matching issuer names alone is not used.'}</p>
      <ul className="correlation-matches">{group.matches.map((match) => <li key={match.id}><div><strong>{match.target}</strong><p className="caption grey">{match.roles.join(' · ')} · {formatDate(match.createdAt)}</p></div><Badge tone={classificationTone(match.classification)}>{match.classification}</Badge><button className="btn btn--ghost" onClick={() => setSelected(match.id)} aria-label={`Open evidence report for ${match.target}`}>View report</button></li>)}</ul>
    </article>)}</div> : <Empty title={filter === 'review' ? 'No related indicators requiring review' : 'No shared indicators found'} text={query ? 'Try another domain or fingerprint.' : filter === 'review' && correlation.groups.length ? 'Choose All connections to see repeated observations with no flagged report.' : 'Run more investigations or load older history to compare their evidence.'} />}
    {scans.length < total && <button className="btn btn--ghost" disabled={pending} onClick={loadMore}>Load more investigations</button>}
    {selected && <ReportDetails id={selected} onClose={() => setSelected(null)} />}
  </>
}
