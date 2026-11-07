'use client'

import Link from 'next/link'
import { useDash } from './context.js'
import { Badge } from '../../components/Sections.jsx'
import { classificationTone, formatDate } from '../../lib/investigations.js'
import { summarize } from '../../lib/overview.mjs'
import { ArrowIcon, FileIcon, GlobeIcon, InfoIcon, ScanIcon, ShieldIcon } from '../../components/Icons.jsx'
import { Empty } from './ui.jsx'
import HistoryStatus from './HistoryStatus.jsx'

function Activity({ days }) {
  const max = Math.max(1, ...days.map((day) => day.count))
  const total = days.reduce((sum, day) => sum + day.count, 0)
  return <div className="overview-chart">
    <div className="overview-chart-caption"><strong>{total}<span> investigations in this period</span></strong><span>Loaded history / last 7 days</span></div>
    <svg viewBox="0 0 640 184" role="img" aria-label={`Daily investigation activity: ${days.map((day) => `${day.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: ${day.count}`).join(', ')}`}>
      {[0, .5, 1].map((fraction) => <g key={fraction}><line x1="32" x2="628" y1={142 - fraction * 110} y2={142 - fraction * 110} stroke="var(--line)" strokeDasharray={fraction ? '3 5' : undefined} /><text x="20" y={146 - fraction * 110} textAnchor="end" className="overview-axis">{Number.isInteger(max * fraction) ? max * fraction : ''}</text></g>)}
      {days.map((day, index) => <g key={day.date.toISOString()}><rect className="overview-activity-bar" x={51 + index * 83} y={142 - day.count / max * 110} width="32" height={day.count / max * 110} rx="4"><title>{day.date.toLocaleDateString()}: {day.count} investigations</title></rect><text x={67 + index * 83} y={131 - day.count / max * 110} textAnchor="middle" className="overview-value">{day.count}</text><text x={67 + index * 83} y="170" textAnchor="middle" className="overview-axis">{day.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</text></g>)}
    </svg>
  </div>
}

function Distribution({ items, total }) {
  const circumference = 2 * Math.PI * 42
  let offset = 0
  return <div className="overview-distribution">
    <div className="overview-ring"><svg viewBox="0 0 110 110" role="img" aria-label={`Assessment distribution across ${total} loaded investigations`}><circle cx="55" cy="55" r="42" fill="none" stroke="var(--line)" strokeWidth="10" />{items.filter((item) => item.count).map((item) => {
      const length = item.count / total * circumference
      const start = offset
      offset += length
      return <circle key={item.key} cx="55" cy="55" r="42" fill="none" stroke={item.color} strokeWidth="10" strokeDasharray={`${Math.max(0, length - 2)} ${circumference - Math.max(0, length - 2)}`} strokeDashoffset={-start} transform="rotate(-90 55 55)" />
    })}</svg><div><strong>{total}</strong><span>loaded records</span></div></div>
    <ul className="overview-legend">{items.map((item) => <li key={item.key}><i style={{ background: item.color }} aria-hidden="true" /><span>{item.label}</span><strong>{item.count}</strong></li>)}</ul>
  </div>
}

function hostname(url) {
  try { return new URL(url).hostname } catch { return url }
}

export default function Overview() {
  const { scans, total, user, historyLoading, historyError } = useDash()
  const { distribution, days } = summarize(scans)
  const count = (key) => distribution.find((item) => item.key === key)?.count || 0
  const metrics = [
    ['Saved investigations', total, 'All saved records', FileIcon, 'blue'],
    ['Known malicious', count('malicious'), 'In loaded history', ShieldIcon, 'red'],
    ['Low risk', count('low'), 'No significant indicators found', ShieldIcon, 'green'],
    ['Needs verification', count('inconclusive'), 'Inconclusive assessments', InfoIcon, 'amber'],
  ]
  return <div className="overview-workspace">
    <header className="overview-heading"><div><p className="overview-eyebrow">SECURITY WORKSPACE</p><h1>Investigation overview</h1><p>Welcome back, {user.name.split(' ')[0]}. Review your website assessments and recent activity.</p></div><button className="btn btn--ink" onClick={() => document.getElementById('dash-scan')?.focus()}><ScanIcon />New investigation</button></header>
    <section className="overview-metrics" aria-label="Investigation metrics">{metrics.map(([title, value, note, Icon, accent]) => <article className="overview-metric" key={title} data-accent={accent}><div className="overview-metric-top"><span>{title}</span><span className="overview-metric-icon"><Icon /></span></div><strong>{historyLoading && !scans.length ? '...' : value}</strong><p>{note}</p></article>)}</section>
    <div className="overview-analytics">
      <section className="overview-surface"><div className="overview-section-head"><div><h2>Investigation activity</h2><p>Daily submissions in your loaded history</p></div><span className="overview-period">7 days</span></div><Activity days={days} /></section>
      <section className="overview-surface"><div className="overview-section-head"><div><h2>Assessment breakdown</h2><p>Backend classifications / loaded records</p></div><ShieldIcon /></div><Distribution items={distribution} total={scans.length} /><p className="overview-scope"><InfoIcon />Low risk does not guarantee website safety.</p></section>
    </div>
    <section className="overview-surface overview-recent"><div className="overview-section-head"><div><h2>Recent investigations</h2><p>Latest saved evidence reports</p></div><Link href="/dashboard/scans" className="overview-view-all">View all scans<ArrowIcon /></Link></div>
      <HistoryStatus />
      <div className="table-wrap"><table className="table"><thead><tr><th>Website</th><th>Assessment</th><th>Investigated</th><th className="t-right">Evidence report</th></tr></thead><tbody>
        {scans.slice(0, 6).map((scan) => <tr key={scan.id}><td><div className="overview-website"><span className="overview-site-icon"><GlobeIcon /></span><div><strong>{hostname(scan.normalized_url || scan.submitted_url)}</strong><span>{scan.normalized_url || scan.submitted_url}</span></div></div></td><td><Badge tone={classificationTone(scan.risk_classification)}>{scan.risk_classification}</Badge></td><td className="grey">{formatDate(scan.created_at)}</td><td className="t-right"><Link className="overview-report-link" href={`/dashboard/scans?report=${encodeURIComponent(scan.id)}`}>Open report<ArrowIcon /></Link></td></tr>)}
      </tbody></table></div>
      {!scans.length && !historyLoading && !historyError && <Empty title="No investigations yet" text="Submit a URL in the scan bar to collect real evidence." />}
    </section>
    <p className="overview-footnote"><InfoIcon />Charts and assessment counts cover {scans.length} loaded records out of {total} saved investigations. Load more history to expand the view.</p>
  </div>
}
