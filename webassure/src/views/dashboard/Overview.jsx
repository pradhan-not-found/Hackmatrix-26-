'use client'

import Link from 'next/link'
import { useDash } from './context.js'
import { Badge } from '../../components/Sections.jsx'
import { CATEGORIES, CERTS, DAYS, SCANS_PER_DAY, tone, verdict } from '../../lib/data.js'
import { Bars, Kpi, PageHead, RiskCell, TrendChart } from './ui.jsx'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export default function Overview() {
  const { scans, user } = useDash()
  const high = scans.filter((s) => s.risk >= 55).length
  const total = SCANS_PER_DAY.reduce((a, b) => a + b, 0)

  return (
    <>
      <PageHead title={`${greeting()}, ${user.name.split(' ')[0]}`} sub="Here is what WebAssure saw in the last 14 days." />

      <section className="kpis">
        <Kpi label="Scans" value={total.toLocaleString('en-IN')} delta="+18% vs prior 14 days" />
        <Kpi label="Threats detected" value="364" delta="+9% vs prior 14 days" />
        <Kpi label="Certificates monitored" value={CERTS.length} delta={`${CERTS.filter((c) => c.status !== 'ok').length} need attention`} />
        <Kpi label="High risk in recent scans" value={`${high} of ${scans.length}`} delta="Latest submissions" />
      </section>

      <section className="dash__grid">
        <div className="card panel">
          <div className="panel__head">
            <div>
              <h2 className="panel__title">Scans per day</h2>
              <p className="caption grey">URLs, domains and messages submitted</p>
            </div>
          </div>
          <TrendChart labels={DAYS} values={SCANS_PER_DAY} />
        </div>
        <div className="card panel">
          <div className="panel__head">
            <div>
              <h2 className="panel__title">Threats by category</h2>
              <p className="caption grey">Last 14 days</p>
            </div>
          </div>
          <Bars data={CATEGORIES} />
        </div>
      </section>

      <section className="dash__grid">
        <div className="card panel">
          <div className="panel__head">
            <h2 className="panel__title">Recent scans</h2>
            <Link href="/dashboard/scans" className="link-sm">View all</Link>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>URL</th><th>Risk</th><th>Verdict</th><th className="t-right">When</th></tr></thead>
              <tbody>
                {scans.slice(0, 5).map((s) => (
                  <tr key={s.id} data-fresh={s.fresh || undefined}>
                    <td className="table__url">{s.url}</td>
                    <td><RiskCell risk={s.risk} tone={tone(s.risk)} /></td>
                    <td><Badge tone={tone(s.risk)}>{verdict(s.risk)}</Badge></td>
                    <td className="grey t-right">{s.when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card panel">
          <div className="panel__head">
            <h2 className="panel__title">Certificate watch</h2>
            <Link href="/dashboard/certificates" className="link-sm">Manage</Link>
          </div>
          <ul className="list">
            {CERTS.slice(0, 4).map((c) => (
              <li key={c.host}>
                <div className="list__txt">
                  <p>{c.host}</p>
                  <p className="caption grey">{c.status === 'bad' ? 'Not in CT logs' : `Expires in ${c.days} days`}</p>
                </div>
                <Badge tone={c.status}>{c.status === 'ok' ? 'Valid' : c.status === 'warn' ? 'Expiring' : 'Alert'}</Badge>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}
