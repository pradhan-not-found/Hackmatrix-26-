'use client'

import { useCallback, useEffect, useState } from 'react'
import { useDash } from './context.js'
import { Badge } from '../../components/Sections.jsx'
import { classificationTone, formatDate } from '../../lib/investigations.js'
import { Empty, PageHead, Tabs } from './ui.jsx'
import HistoryStatus from './HistoryStatus.jsx'
import ReportDetails from './ReportDetails.jsx'

export default function Scans() {
  const { scans, historyLoading, historyError, focusId, clearFocus } = useDash()
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('report')
    if (id) setSelected(id)
  }, [])
  useEffect(() => {
    if (focusId) {
      setSelected(focusId)
      window.history.replaceState(null, '', `?report=${encodeURIComponent(focusId)}`)
      clearFocus()
    }
  }, [focusId, clearFocus])
  const close = useCallback(() => {
    setSelected(null)
    window.history.replaceState(null, '', '/dashboard/scans')
  }, [])
  const select = (id) => {
    setSelected(id)
    window.history.replaceState(null, '', `?report=${encodeURIComponent(id)}`)
  }
  const rows = scans.filter((scan) => (filter === 'all' || scan.risk_classification === filter)
    && (scan.normalized_url || scan.submitted_url).toLowerCase().includes(query.toLowerCase()))
  return <>
    <PageHead title="Scans" sub="Saved URL investigations from the backend. Classifications reflect available evidence." />
    <HistoryStatus />
    <div className="card panel panel--flush">
      <div className="toolbar"><Tabs value={filter} onChange={setFilter} options={[
        ['all', 'All'], ['Confirmed Malicious', 'Malicious'], ['High Risk', 'High risk'],
        ['Suspicious', 'Suspicious'], ['Low Risk', 'Low risk'], ['Inconclusive', 'Inconclusive'],
      ]} /><input className="input-sm" placeholder="Filter by URL" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Filter scans by URL" /></div>
      {rows.length ? <div className="table-wrap"><table className="table"><thead><tr><th>URL</th><th>Assessment</th><th>Status</th><th>Created</th><th>Report</th></tr></thead><tbody>
        {rows.map((scan) => <tr key={scan.id} aria-selected={selected === scan.id}>
          <td className="table__url">{scan.normalized_url || scan.submitted_url}</td>
          <td><Badge tone={classificationTone(scan.risk_classification)}>{scan.risk_classification}</Badge></td>
          <td className="grey">{scan.status}</td><td className="grey">{formatDate(scan.created_at)}</td>
          <td><button className="btn btn--ghost" onClick={() => select(scan.id)} aria-label={`Open report for ${scan.normalized_url || scan.submitted_url}`}>Open report</button></td>
        </tr>)}
      </tbody></table></div> : !historyLoading && !historyError && <Empty title={scans.length ? 'No scans match' : 'No saved investigations'} text="Submit a URL in the scan bar above. Results are saved by the backend." />}
    </div>
    {selected && <ReportDetails key={selected} id={selected} onClose={close} />}
  </>
}
