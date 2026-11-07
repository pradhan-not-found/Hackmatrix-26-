'use client'

import { useState } from 'react'
import { Badge } from '../../components/Sections.jsx'
import { THREATS } from '../../lib/data.js'
import { Kpi, PageHead, Tabs } from './ui.jsx'

const statusTone = { Active: 'bad', Mitigated: 'warn', 'Taken down': 'ok' }

export default function Threats() {
  const [filter, setFilter] = useState('all')
  const rows = THREATS.filter((t) => filter === 'all' || t.status === filter)
  const count = (s) => THREATS.filter((t) => t.status === s).length

  return (
    <>
      <PageHead title="Threats" sub="Campaigns grouped from related malicious URLs." />

      <section className="kpis kpis--3">
        <Kpi label="Active campaigns" value={count('Active')} />
        <Kpi label="Malicious URLs tracked" value={THREATS.reduce((a, t) => a + t.urls, 0)} />
        <Kpi label="Taken down this month" value={count('Taken down')} />
      </section>

      <div className="card panel panel--flush">
        <div className="toolbar">
          <Tabs value={filter} onChange={setFilter} options={[['all', 'All'], ['Active', 'Active'], ['Mitigated', 'Mitigated'], ['Taken down', 'Taken down']]} />
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Campaign</th><th>Type</th><th>Targets</th><th className="t-right">URLs</th><th>First seen</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td>
                    <span className="table__url">{t.name}</span>
                    <span className="caption grey table__sub">{t.id}</span>
                  </td>
                  <td className="grey">{t.type}</td>
                  <td className="grey">{t.targets}</td>
                  <td className="t-right tabnum">{t.urls}</td>
                  <td className="grey">{t.first}</td>
                  <td><Badge tone={statusTone[t.status]}>{t.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
