'use client'

import { Badge } from '../../components/Sections.jsx'
import { LEDGER } from '../../lib/data.js'
import { Kpi, PageHead } from './ui.jsx'

const st = { Anchored: 'ok', Pending: 'warn', Disputed: 'bad' }

export default function Ledger() {
  return (
    <>
      <PageHead title="Threat ledger" sub="Demo preview — sample entries only. Blockchain report registration is not connected." />

      <section className="kpis kpis--3">
        <Kpi label="Reports anchored" value="4,821" delta="All time" />
        <Kpi label="Your submissions" value="37" delta="31 anchored · 4 pending · 2 disputed" />
        <Kpi label="Median confirmations" value="9" delta="Required to anchor: 5" />
      </section>

      <div className="card panel panel--flush">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Report</th><th>URL</th><th className="t-right">Confirmations</th><th>Transaction</th><th>Block</th><th>Status</th><th className="t-right">When</th></tr></thead>
            <tbody>
              {LEDGER.map((l) => (
                <tr key={l.id}>
                  <td className="table__url">{l.id}</td>
                  <td>{l.url}</td>
                  <td className="t-right tabnum">{l.confirmations}</td>
                  <td className="mono grey">{l.tx}</td>
                  <td className="grey tabnum">{l.block}</td>
                  <td><Badge tone={st[l.status]}>{l.status}</Badge></td>
                  <td className="grey t-right">{l.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
