'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useDash } from './context.js'
import { Badge } from '../../components/Sections.jsx'
import { classificationTone, downloadReport, formatDate } from '../../lib/investigations.js'
import { Empty, PageHead } from './ui.jsx'
import HistoryStatus from './HistoryStatus.jsx'
import SiteIcon from '../../components/SiteIcon.jsx'

export default function Reports() {
  const { scans, getReport, historyLoading, historyError } = useDash()
  const [downloading, setDownloading] = useState(null)
  const [error, setError] = useState('')
  const [failedId, setFailedId] = useState(null)
  const download = async (id) => {
    setDownloading(id)
    setError('')
    try { downloadReport(await getReport(id)); setFailedId(null) }
    catch (failure) { setError(failure.message); setFailedId(id) }
    finally { setDownloading(null) }
  }
  return <>
    <PageHead title="Reports" sub="Full evidence reports saved in the investigation database." />
    <HistoryStatus />
    {error && <div className="dash__err" role="alert">{error} <button className="btn btn--ghost" onClick={() => download(failedId)} disabled={!!downloading}>Retry download</button></div>}
    <div className="card panel panel--flush"><div className="table-wrap"><table className="table"><thead><tr><th>URL</th><th>Assessment</th><th>Created</th><th>Report</th></tr></thead><tbody>
      {scans.map((scan) => <tr key={scan.id}>
        <td className="table__url"><span className="url-cell"><SiteIcon url={scan.normalized_url || scan.submitted_url} size={16} className="site-icon--sm" /><span>{scan.normalized_url || scan.submitted_url}</span></span></td>
        <td><Badge tone={classificationTone(scan.risk_classification)}>{scan.risk_classification}</Badge></td>
        <td className="grey">{formatDate(scan.created_at)}</td>
        <td><div className="report-actions"><Link className="btn btn--ghost" href={`/dashboard/scans?report=${encodeURIComponent(scan.id)}`}>Open report</Link><button className="btn btn--ghost" disabled={!!downloading} onClick={() => download(scan.id)}>{downloading === scan.id ? 'Downloading…' : 'Download JSON'}</button></div></td>
      </tr>)}
    </tbody></table></div>
    {!scans.length && !historyLoading && !historyError && <Empty title="No reports yet" text="Run an investigation to save its evidence report here." />}
    </div>
  </>
}
