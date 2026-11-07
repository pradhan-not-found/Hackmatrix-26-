'use client'

import { useEffect, useRef, useState } from 'react'
import { Badge } from '../../components/Sections.jsx'
import { classificationTone, downloadReport, formatDate } from '../../lib/investigations.js'
import { useDash } from './context.js'
import { AlertIcon, CheckIcon, CloseIcon, DownloadIcon, FileIcon, GlobeIcon, InfoIcon, LockIcon, RouteIcon, SettingsIcon, ShieldIcon } from '../../components/Icons.jsx'

const CHECK_LABELS = { url_structure: 'URL identity', dns: 'DNS resolution', http: 'HTTP response', tls: 'TLS verification', redirects: 'Redirect chain', security_headers: 'Security headers', threat_intelligence: 'Threat intelligence', html_inspection: 'HTML inspection', certificate_revocation: 'Certificate revocation', certificate_transparency: 'Certificate transparency', certificate_key_strength: 'Certificate key strength' }
const label = (name) => CHECK_LABELS[name] || name.replaceAll('_', ' ')
const stateTone = (state) => state === 'completed' ? 'ok' : ['failed', 'blocked'].includes(state) ? 'bad' : ['unavailable', 'partial'].includes(state) ? 'warn' : 'neutral'
const StateIcon = ({ state }) => state === 'completed' ? <CheckIcon /> : ['failed', 'blocked', 'unavailable', 'partial'].includes(state) ? <AlertIcon /> : <InfoIcon />

function SectionTitle({ icon: Icon, children, detail }) {
  return <div className="analysis-section-title"><Icon /><h3>{children}</h3>{detail && <span>{detail}</span>}</div>
}

function Coverage({ coverage }) {
  const checks = coverage?.checks || []
  const implemented = checks.filter((check) => check.status !== 'not_implemented')
  const completed = implemented.filter((check) => check.status === 'completed').length
  return <div className="analysis-coverage">
    <div className="analysis-coverage-top"><strong>Inspection coverage</strong><span>{checks.length ? `${completed} completed · ${implemented.length} implemented checks` : 'Detailed coverage unavailable in this saved report'}</span></div>
    {!!checks.length && <div className="analysis-coverage-bar" aria-hidden="true">{checks.map((check) => <span key={check.name} data-tone={stateTone(check.status)} />)}</div>}
    <div className="analysis-check-grid">{checks.map((check) => <div className="analysis-check-cell" key={check.name} data-tone={stateTone(check.status)}><StateIcon state={check.status} /><div><strong>{label(check.name)}</strong><span>{check.status.replaceAll('_', ' ')}</span></div></div>)}</div>
    <p className="caption grey">Coverage describes checks performed, not a safety score. Unimplemented checks are shown separately.</p>
  </div>
}

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
  const verdictTone = report ? classificationTone(report.risk_classification) : 'neutral'
  const configurationCount = report?.findings.filter((finding) => finding.kind === 'security_configuration').length || 0
  return <dialog className="drawer report-drawer" ref={dialog} aria-label="Scan details" onCancel={onClose}>
    <div className="drawer__head analysis-header"><div><p className="analysis-eyebrow">WEBASSURE / INVESTIGATIONS</p><h2 className="drawer__title">Investigation report</h2></div><button className="icon-btn" onClick={onClose} aria-label="Close report"><CloseIcon /></button></div>
    {!report && !error && <div className="analysis-loading"><p role="status">Loading saved report…</p><span /><span /><span /></div>}
    {error && <div role="alert" className="analysis-error"><AlertIcon /><p>{error}</p><button className="btn btn--ink" onClick={() => setAttempt((value) => value + 1)}>Retry report</button></div>}
    {report && <>
      <div className="analysis-target"><GlobeIcon /><div><p className="report-url">{report.normalized_url}</p><p className="caption grey">Investigated {formatDate(report.created_at)}</p><p className="caption grey">Report {report.id}</p></div></div>
      <div className="analysis-verdict" data-tone={verdictTone}>
        <span className="analysis-verdict-icon">{verdictTone === 'bad' || verdictTone === 'warn' ? <AlertIcon /> : verdictTone === 'ok' ? <ShieldIcon /> : <InfoIcon />}</span>
        <div><p className="analysis-eyebrow">PHISHING ASSESSMENT</p><Badge tone={verdictTone}>{report.risk_classification}</Badge><p className="caption grey">Evidence-based assessment. Configuration warnings are evaluated separately.</p></div>
      </div>
      <div className="analysis-facts"><div><span>Findings</span><strong>{report.findings.length}</strong></div><div><span>Configuration warnings</span><strong>{configurationCount}</strong></div><div><span>Requests collected</span><strong>{report.redirect_chain.length}</strong></div></div>
      {report.assessment && <Evidence title="Assessment decision" value={report.assessment} />}
      <section><SectionTitle icon={CheckIcon}>Coverage</SectionTitle><div className="analysis-availability"><span><GlobeIcon />Network inspection: {report.evidence_coverage?.network_complete ? 'Complete' : 'Incomplete'}</span><span><ShieldIcon />Threat intelligence: {report.evidence_coverage?.reputation_available ? 'Available' : 'Unavailable'}</span></div><Coverage coverage={report.evidence_coverage} /><p className="analysis-caution"><InfoIcon />No detected threats does not guarantee safety.</p></section>
      {report.evidence_coverage?.checks && <Evidence title="Completed, incomplete & unimplemented checks" value={report.evidence_coverage.checks} />}
      {!!report.url_analysis?.length && <section><SectionTitle icon={GlobeIcon}>Domain identity</SectionTitle><div className="analysis-domains">{report.url_analysis.map((domain) => <article className="analysis-domain" key={domain.url}><p className="analysis-domain-host"><GlobeIcon />{domain.hostname}</p>{domain.unicode_hostname !== domain.hostname && <p className="caption grey">Unicode: {domain.unicode_hostname}</p>}<dl><div><dt>Registrable domain</dt><dd>{domain.registrable_domain || 'Not determined'}</dd></div><div><dt>Public suffix</dt><dd>{domain.suffix || 'Not determined'}</dd></div><div><dt>Subdomain</dt><dd>{domain.subdomain || 'None'}</dd></div></dl></article>)}</div></section>}
      {report.url_analysis && <Evidence title="Domain identity & URL indicators" value={report.url_analysis} />}
      <section className="analysis-explanation"><SectionTitle icon={FileIcon}>Understand this report</SectionTitle>
        {explanation?.status === 'completed' ? <>
          <p className="caption grey">{explanation.provider} · {explanation.model}</p>
          <ExplanationText item={explanation.summary} evidence={explanation.evidence || []} />
          {[["What the checks mean", explanation.explanations], ["What to do next", explanation.next_steps]].map(([title, items]) => <details key={title} className="report-group"><summary>{title}</summary>{items.map((item, index) => <ExplanationText key={index} item={item} evidence={explanation.evidence || []} />)}</details>)}
        </> : <p className="caption grey">{explanation?.reason || 'No explanation was saved with this report. Review the findings and check details below.'}</p>}
      </section>
      <section><SectionTitle icon={ShieldIcon} detail={`${report.findings.length} recorded`}>Findings</SectionTitle>
        {!report.findings.length && <p className="caption grey">No findings recorded. Review coverage before drawing conclusions.</p>}
        {report.findings.map((finding) => <article className="report-item analysis-finding" key={finding.id} data-severity={finding.severity}>
          <div className="analysis-finding-head"><span className="analysis-category-icon">{finding.kind === 'security_configuration' ? <SettingsIcon /> : <ShieldIcon />}</span><strong>{finding.description}</strong><span className="analysis-severity">{finding.severity}</span></div><p className="caption grey">{finding.kind?.replaceAll('_', ' ') || finding.category} · {finding.source} · {formatDate(finding.observed_at)}</p><Evidence value={finding.evidence} />
        </article>)}
      </section>
      <section><SectionTitle icon={CheckIcon} detail={`${report.checks.length} observations`}>Individual checks</SectionTitle>
        {report.checks.map((check, index) => <article className="report-item analysis-check-row" key={index} data-tone={stateTone(check.status)}>
          <div className="analysis-check-row-title"><StateIcon state={check.status} /><strong>{label(check.name)}</strong><span className="analysis-check-state">{check.status.replaceAll('_', ' ')}</span></div>
          {(check.reason || check.error) && <p>{check.reason || check.error}</p>}
          <Evidence title="Check details" value={check} />
        </article>)}
      </section>
      <section><SectionTitle icon={RouteIcon}>Redirects & TLS</SectionTitle>
        {!report.redirect_chain.length && <p className="caption grey">No HTTP response collected. Check DNS, TLS, and destination policy results.</p>}
        <ol className="analysis-route">{report.redirect_chain.map((hop, index) => <li className="analysis-hop" key={index}>
          <span className="analysis-hop-marker">{String(index + 1).padStart(2, '0')}</span><div className="analysis-hop-content"><p className="report-url">{hop.url}</p><p className="caption grey">HTTP {hop.status} · {hop.address}</p>
          {hop.tls && <div className="analysis-tls"><LockIcon /><div><strong>Verified TLS connection</strong><p>{hop.tls.protocol || 'TLS'}{hop.tls.cipher ? ` · ${hop.tls.cipher}` : ''}</p>{hop.tls.not_after && <p className="caption grey">Certificate expires {hop.tls.not_after}</p>}</div></div>}
          {hop.tls ? <Evidence title="Certificate & TLS details" value={hop.tls} /> : <p>Unencrypted HTTP; no TLS certificate.</p>}
          <Evidence title="Response headers" value={hop.headers} />
          </div></li>)}</ol>
      </section>
      <section><SectionTitle icon={CheckIcon}>Recommended actions</SectionTitle><ul className="analysis-actions">{report.recommendations.map((text) => <li key={text}><CheckIcon /><span>{text}</span></li>)}</ul></section>
      <section className="analysis-limitations"><SectionTitle icon={InfoIcon}>Limitations</SectionTitle><ul className="drawer__list">{report.limitations.map((text) => <li key={text}>{text}</li>)}</ul></section>
      <Evidence title="Full report JSON" value={report} />
      <div className="analysis-footer"><span className="caption grey">Report {report.id}</span><button className="btn btn--ink" onClick={() => downloadReport(report)}><DownloadIcon />Export report JSON</button></div>
    </>}
  </dialog>
}
