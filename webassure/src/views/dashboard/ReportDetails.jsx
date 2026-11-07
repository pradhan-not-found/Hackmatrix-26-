'use client'

import { useEffect, useRef, useState } from 'react'
import { Badge } from '../../components/Sections.jsx'
import { classificationTone, downloadReport, formatDate } from '../../lib/investigations.js'
import { useDash } from './context.js'

function Evidence({ title = 'Supporting evidence', value }) {
  return <details className="report-evidence"><summary>{title}</summary><pre>{JSON.stringify(value, null, 2)}</pre></details>
}

function ExplanationText({ item, evidence }) {
  return <div className="report-statement"><p>{item.text}</p><Evidence
    title={`Evidence: ${item.evidence_ids.join(', ')}`}
    value={evidence.filter((source) => item.evidence_ids.includes(source.id))} /></div>
}

export default function ReportDetails({ id, onClose }) {
  const { getReport } = useDash()
  const dialog = useRef(null)
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => { dialog.current.showModal() }, [])
  useEffect(() => {
    let active = true
    setReport(null)
    setError('')
    getReport(id).then((value) => { if (active) setReport(value) })
      .catch((failure) => { if (active) setError(failure.message) })
    return () => { active = false }
  }, [id, attempt, getReport])
  const explanation = report?.ai_explanation
  return <dialog className="drawer report-drawer" ref={dialog} aria-label="Scan details" onCancel={onClose}>
    <div className="drawer__head"><h2 className="drawer__title">Investigation report</h2><button className="icon-btn" onClick={onClose} aria-label="Close report">×</button></div>
    {!report && !error && <p role="status">Loading saved report…</p>}
    {error && <div role="alert"><p>{error}</p><button className="btn btn--ink" onClick={() => setAttempt((value) => value + 1)}>Retry report</button></div>}
    {report && <>
      <p className="report-url">{report.normalized_url}</p>
      <p className="caption grey">{report.id} · {formatDate(report.created_at)}</p>
      <div className="drawer__score"><Badge tone={classificationTone(report.risk_classification)}>{report.risk_classification}</Badge><span className="caption grey">Phishing assessment · configuration findings are separate</span></div>
      {report.assessment && <Evidence title="Assessment decision" value={report.assessment} />}
      <section><h3 className="drawer__h">Coverage</h3><p>Network inspection: {report.evidence_coverage?.network_complete ? 'Complete' : 'Incomplete'}</p><p>Threat intelligence: {report.evidence_coverage?.reputation_available ? 'Available' : 'Unavailable'}</p><p className="caption grey">No detected threats does not guarantee safety.</p></section>
      {report.evidence_coverage?.checks && <Evidence title="Completed, incomplete & unimplemented checks" value={report.evidence_coverage.checks} />}
      {report.url_analysis && <Evidence title="Domain identity & URL indicators" value={report.url_analysis} />}
      <section><h3 className="drawer__h">Understand this report</h3>
        {explanation?.status === 'completed' ? <>
          <p className="caption grey">{explanation.provider} · {explanation.model}</p>
          <ExplanationText item={explanation.summary} evidence={explanation.evidence || []} />
          {[["What the checks mean", explanation.explanations], ["What to do next", explanation.next_steps]].map(([title, items]) => <details key={title} className="report-group"><summary>{title}</summary>{items.map((item, index) => <ExplanationText key={index} item={item} evidence={explanation.evidence || []} />)}</details>)}
        </> : <p className="caption grey">{explanation?.reason || 'No explanation was saved with this report. Review the findings and check details below.'}</p>}
      </section>
      <section><h3 className="drawer__h">Findings ({report.findings.length})</h3>
        {!report.findings.length && <p className="caption grey">No findings recorded. Review coverage before drawing conclusions.</p>}
        {report.findings.map((finding) => <article className="report-item" key={finding.id}>
          <strong>{finding.description}</strong><p className="caption grey">{finding.kind?.replaceAll('_', ' ') || finding.category} · {finding.severity} · {finding.source} · {formatDate(finding.observed_at)}</p><Evidence value={finding.evidence} />
        </article>)}
      </section>
      <section><h3 className="drawer__h">Individual checks</h3>
        {report.checks.map((check, index) => <article className="report-item" key={index}>
          <strong>{check.name.replaceAll('_', ' ')} — {check.status}</strong>
          {(check.reason || check.error) && <p>{check.reason || check.error}</p>}
          <Evidence title="Check details" value={check} />
        </article>)}
      </section>
      <section><h3 className="drawer__h">Redirects & TLS</h3>
        {!report.redirect_chain.length && <p className="caption grey">No HTTP response collected. Check DNS, TLS, and destination policy results.</p>}
        {report.redirect_chain.map((hop, index) => <article className="report-item" key={index}>
          <p className="report-url">{index + 1}. {hop.url}</p><p className="caption grey">HTTP {hop.status} · {hop.address}</p>
          {hop.tls ? <Evidence title="Certificate & TLS details" value={hop.tls} /> : <p>Unencrypted HTTP; no TLS certificate.</p>}
          <Evidence title="Response headers" value={hop.headers} />
        </article>)}
      </section>
      <section><h3 className="drawer__h">Recommended actions</h3><ul className="drawer__list">{report.recommendations.map((text) => <li key={text}>{text}</li>)}</ul></section>
      <section><h3 className="drawer__h">Limitations</h3><ul className="drawer__list">{report.limitations.map((text) => <li key={text}>{text}</li>)}</ul></section>
      <Evidence title="Full report JSON" value={report} />
      <button className="btn btn--ink" onClick={() => downloadReport(report)}>Export report JSON</button>
    </>}
  </dialog>
}
