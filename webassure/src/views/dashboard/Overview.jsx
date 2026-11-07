'use client'

import Link from 'next/link'
import { useDash } from './context.js'
import { Badge } from '../../components/Sections.jsx'
import { classificationTone, formatDate } from '../../lib/investigations.js'
import { Empty, Kpi, PageHead } from './ui.jsx'
import HistoryStatus from './HistoryStatus.jsx'

export default function Overview() {
  const { scans, total, user, historyLoading, historyError } = useDash()
  const count = (classification) => scans.filter((scan) => scan.risk_classification === classification).length
  return <>
    <PageHead title={`Welcome, ${user.name.split(' ')[0]}`} sub="Live investigation results. Assessment counts below cover the loaded history only." />
    <section className="kpis">
      <Kpi label="Saved investigations" value={total} />
      <Kpi label="Known malicious · loaded" value={count('Confirmed Malicious')} />
      <Kpi label="Suspicious · loaded" value={count('Suspicious')} />
      <Kpi label="Inconclusive · loaded" value={count('Inconclusive')} />
    </section>
    <HistoryStatus />
    <div className="card panel"><div className="panel__head"><h2 className="panel__title">Recent investigations</h2><Link href="/dashboard/scans" className="link-sm">View scans</Link></div>
      <div className="table-wrap"><table className="table"><thead><tr><th>URL</th><th>Assessment</th><th>Created</th><th>Report</th></tr></thead><tbody>
        {scans.slice(0, 5).map((scan) => <tr key={scan.id}><td className="table__url">{scan.normalized_url || scan.submitted_url}</td><td><Badge tone={classificationTone(scan.risk_classification)}>{scan.risk_classification}</Badge></td><td className="grey">{formatDate(scan.created_at)}</td><td><Link className="btn btn--ghost" href={`/dashboard/scans?report=${encodeURIComponent(scan.id)}`}>Open report</Link></td></tr>)}
      </tbody></table></div>
      {!scans.length && !historyLoading && !historyError && <Empty title="No investigations yet" text="Submit a URL in the scan bar to collect real evidence." />}
    </div>
  </>
}
