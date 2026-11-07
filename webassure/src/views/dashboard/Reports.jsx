'use client'

import { useDash } from './context.js'
import { FileIcon } from '../../components/Icons.jsx'
import { REPORTS, tone, verdict } from '../../lib/data.js'
import { PageHead } from './ui.jsx'

function download(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export default function Reports() {
  const { scans } = useDash()

  const exportScans = () =>
    download('webassure-scans.json', scans.map(({ id, url, risk, category, source, when, findings }) => ({
      id, url, risk, verdict: verdict(risk), level: tone(risk), category, source, when, findings,
    })))

  return (
    <>
      <PageHead title="Reports" sub="Shareable evidence for your team, clients or regulators.">
        <button className="btn btn--ink" onClick={exportScans}>Export all scans</button>
      </PageHead>

      <div className="card panel panel--flush">
        <ul className="rlist">
          {REPORTS.map((r) => (
            <li key={r.id}>
              <span className="rlist__icon"><FileIcon /></span>
              <div className="rlist__txt">
                <p>{r.title}</p>
                <p className="caption grey">{r.id} · {r.range}</p>
              </div>
              <span className="rlist__type">{r.type}</span>
              <span className="caption grey rlist__date">{r.created}</span>
              <button className="btn btn--ghost" onClick={() => download(`${r.id}.json`, { ...r, scans: scans.length })}>Download</button>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
