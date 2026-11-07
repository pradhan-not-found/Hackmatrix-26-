'use client'

import Link from 'next/link'
import { useDash } from './context.js'
import { Badge } from '../../components/Sections.jsx'
import { classificationTone, formatDate } from '../../lib/investigations.js'
import { summarize } from '../../lib/overview.mjs'
import { Bars, Empty, Kpi, PageHead, TrendChart } from './ui.jsx'
import HistoryStatus from './HistoryStatus.jsx'
import { PersonPlaceholder } from '../../components/Icons.jsx'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export default function Overview() {
  const { scans, total, user, historyLoading, historyError } = useDash()
  const { distribution, days } = summarize(scans)
  const count = (key) => distribution.find((item) => item.key === key)?.count || 0
  const loading = historyLoading && !scans.length
  const show = (v) => (loading ? '…' : v)
  const labels = days.map((d) => d.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))

  return (
    <>
      <div className="greet">
        <span className="greet__avatar">
          {user.avatar ? <img src={user.avatar} alt="" /> : <PersonPlaceholder />}
        </span>
        <PageHead title={`${greeting()}, ${user.name.split(' ')[0]}`} sub="Here is what WebAssure has investigated for you." />
      </div>

      <section className="kpis">
        <Kpi label="Saved investigations" value={show(total)} delta="All saved records" />
        <Kpi label="Known malicious" value={show(count('malicious'))} delta="In loaded history" />
        <Kpi label="Low risk" value={show(count('low'))} delta="No significant indicators" />
        <Kpi label="Needs verification" value={show(count('inconclusive'))} delta="Inconclusive assessments" />
      </section>

      <section className="dash__grid">
        <div className="card panel">
          <div className="panel__head">
            <div>
              <h2 className="panel__title">Investigations per day</h2>
              <p className="caption grey">Last 7 days of loaded history</p>
            </div>
          </div>
          <TrendChart labels={labels} values={days.map((d) => d.count)} unit="investigations" />
        </div>
        <div className="card panel">
          <div className="panel__head">
            <div>
              <h2 className="panel__title">Assessment breakdown</h2>
              <p className="caption grey">{scans.length} loaded records</p>
            </div>
          </div>
          <Bars data={distribution.map((d) => [d.label, d.count])} />
        </div>
      </section>

      <section className="card panel">
        <div className="panel__head">
          <h2 className="panel__title">Recent scans</h2>
          <Link href="/dashboard/scans" className="link-sm">View all</Link>
        </div>
        <HistoryStatus />
        {scans.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>URL</th><th>Assessment</th><th className="t-right">When</th></tr></thead>
              <tbody>
                {scans.slice(0, 5).map((s) => (
                  <tr key={s.id}>
                    <td className="table__url">
                      <Link href={`/dashboard/scans?report=${encodeURIComponent(s.id)}`}>{s.normalized_url || s.submitted_url}</Link>
                    </td>
                    <td><Badge tone={classificationTone(s.risk_classification)}>{s.risk_classification}</Badge></td>
                    <td className="grey t-right">{formatDate(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!scans.length && !historyLoading && !historyError && (
          <Empty title="No investigations yet" text="Paste a URL in the scan bar above to run your first check." />
        )}
      </section>
    </>
  )
}
