'use client'

import { useEffect, useRef, useState } from 'react'
import { Badge } from '../../components/Sections.jsx'
import { classificationTone, downloadReport, formatDate } from '../../lib/investigations.js'
import { useDash } from './context.js'
import { AlertIcon, CheckIcon, CloseIcon, DownloadIcon, FileIcon, GlobeIcon, InfoIcon, LockIcon, RouteIcon, SettingsIcon, ShieldIcon } from '../../components/Icons.jsx'
import SiteIcon from '../../components/SiteIcon.jsx'

const CHECK_LABELS = { url_structure: 'URL identity', dns: 'DNS resolution', http: 'HTTP response', tls: 'TLS verification', redirects: 'Redirect chain', security_headers: 'Security headers', threat_intelligence: 'Threat intelligence', html_inspection: 'HTML inspection', certificate_revocation: 'Certificate revocation', certificate_transparency: 'Certificate transparency', certificate_key_strength: 'Certificate key strength', certificate_signature: 'Certificate signature' }
const label = (name) => CHECK_LABELS[name] || name.replaceAll('_', ' ')
const stateTone = (state) => state === 'completed' ? 'ok' : ['failed', 'blocked'].includes(state) ? 'bad' : ['unavailable', 'partial'].includes(state) ? 'warn' : 'neutral'
const StateIcon = ({ state }) => state === 'completed' ? <CheckIcon /> : ['failed', 'blocked', 'unavailable', 'partial'].includes(state) ? <AlertIcon /> : <InfoIcon />

function SectionTitle({ icon: Icon, children, detail }) {
  return <div className="analysis-section-title"><Icon /><h3>{children}</h3>{detail && <span>{detail}</span>}</div>
}

function Coverage({ coverage }) {
  const checks = coverage?.checks || []
  const implemented = checks.filter((check) => check.status !== 'not_implemented')
  const notAssessed = checks.filter((check) => check.status === 'not_implemented')
  const completed = implemented.filter((check) => check.status === 'completed').length
  return <div className="analysis-coverage">
    <div className="analysis-coverage-top"><strong>Inspection coverage</strong><span>{checks.length ? `${completed} completed · ${implemented.length} implemented checks` : 'Detailed coverage unavailable in this saved report'}</span></div>
    {!!implemented.length && <div className="analysis-coverage-bar" aria-hidden="true">{implemented.map((check) => <span key={check.name} data-tone={stateTone(check.status)} />)}</div>}
    <div className="analysis-check-grid">{implemented.map((check) => <div className="analysis-check-cell" key={check.name} data-tone={stateTone(check.status)}><StateIcon state={check.status} /><div><strong>{label(check.name)}</strong><span>{check.status === 'completed' ? 'Check ran' : check.status.replaceAll('_', ' ')}</span></div></div>)}</div>
    <p className="caption grey">A completed check may still report warnings or threats. This is execution coverage, not a safety score.</p>
    {!!notAssessed.length && <div className="analysis-not-assessed"><h4>Not assessed</h4><p className="caption grey">These capabilities are not available in this version and are excluded from the coverage bar.</p><ul>{notAssessed.map((check) => <li key={check.name}><InfoIcon /><span>{label(check.name)}</span></li>)}</ul></div>}
  </div>
}

function Evidence({ title = 'Supporting evidence', value }) {
  return <details className="report-evidence"><summary>{title}</summary><pre>{JSON.stringify(value, null, 2)}</pre></details>
}

function ExplanationText({ item, evidence }) {
  return <div className="report-statement"><p>{item.text}</p><Evidence
    title="View supporting evidence"
    value={evidence.filter((source) => item.evidence_ids.includes(source.id))} /></div>
}

// Line icons for the report tabs (24px grid, 1.8 stroke, matching the dashboard set).
const TAB_PATHS = {
  overview: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.8" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.8" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.8" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.8" /></>,
  checks: <><path d="M4 6.5h9M4 12h9M4 17.5h9" /><path d="m15.5 6.5 1.6 1.6 3.2-3.4M15.5 17.5l1.6 1.6 3.2-3.4" /></>,
  connection: <><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.5 6H14a4 4 0 0 1 0 8h-4a4 4 0 0 0 0 8h5.5" transform="translate(0 -2)" /></>,
  evidence: <><path d="M7 3.5h7l4.5 4.5v12.5H7z" /><path d="M14 3.5V8h4.5" /><path d="M10 12.5h5.5M10 16h5.5" /></>,
}
const TabIcon = ({ name }) => (
  <svg className="report-tab-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{TAB_PATHS[name]}</svg>
)

// The first reason this report could not reach a verdict, in plain language.
function inconclusiveReason(report) {
  const failed = (name) => report.checks.find((check) => check.name === name && !['completed', 'not_applicable'].includes(check.status))
  if (failed('destination_safety')) return 'This address points to a private or unsupported network, so we did not open it.'
  if (failed('dns')) return 'This domain could not be found. It may be fake, already taken down, or mistyped.'
  if (failed('tls')) return "This site's security certificate could not be verified."
  const http = failed('http')
  if (http) return /HTTP\s*\d+/.test(http.reason || '') ? `The site refused our check (${http.reason.match(/HTTP\s*\d+/)[0]}), so its page could not be inspected.` : 'The site did not respond to our check, so its page could not be inspected.'
  if (failed('threat_intelligence')) return 'The threat database could not be reached, so reputation was not checked.'
  if (failed('html_inspection')) return 'The page could not be fully inspected.'
  return 'Some checks could not be completed.'
}

// Step icon for a request in the redirect route: redirect, final page, or error.
const HopIcon = ({ status }) => {
  const kind = status >= 400 ? 'bad' : status >= 300 ? 'redirect' : 'ok'
  return (
    <span className="hop-ic" data-kind={kind} title={kind === 'redirect' ? 'Redirect' : kind === 'ok' ? 'Final response' : 'Error response'}>
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {kind === 'redirect' ? <><path d="M5 7h10a4 4 0 0 1 0 8H8" /><path d="m11 18-3-3 3-3" /></> : kind === 'ok' ? <path d="m5.5 12.5 4 4 9-9" /> : <><path d="M12 7.5v5.5" /><path d="M12 16.5h.01" /></>}
      </svg>
    </span>
  )
}

export default function ReportDetails({ id, onClose }) {
  const { getReport, explainReport } = useDash()
  const dialog = useRef(null)
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [tab, setTab] = useState('overview')
  const [insightBusy, setInsightBusy] = useState(false)
  const [insightError, setInsightError] = useState('')
  const insightVersion = useRef(0)
  const panels = useRef(null)
  useEffect(() => { dialog.current.showModal() }, [])
  // Fade the scroll area's edges only while there is more content in that direction.
  useEffect(() => {
    const el = panels.current
    if (!el) return
    const sync = () => {
      el.style.setProperty('--fade-t', el.scrollTop > 4 ? '36px' : '0px')
      el.style.setProperty('--fade-b', el.scrollHeight - el.clientHeight - el.scrollTop > 4 ? '36px' : '0px')
    }
    sync()
    el.addEventListener('scroll', sync, { passive: true })
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    return () => { el.removeEventListener('scroll', sync); observer.disconnect() }
  }, [report, tab])
  useEffect(() => {
    let active = true
    setReport(null)
    setError('')
    ++insightVersion.current
    setInsightBusy(false)
    setInsightError('')
    getReport(id).then((value) => { if (active) setReport(value) })
      .catch((failure) => { if (active) setError(failure.message) })
    return () => { active = false }
  }, [id, attempt, getReport])
  const explanation = report?.ai_explanation
  const isAI = explanation?.status === 'completed' && explanation.provider === 'Gemini'
  const currentAI = isAI && explanation.insight_version === 'report-insights-v1'
  const generateInsights = async () => {
    const version = insightVersion.current
    setInsightBusy(true); setInsightError('')
    try {
      const next = await explainReport(id)
      if (version !== insightVersion.current) return
      if (next.status !== 'completed') throw new Error(next.reason || 'AI insights are temporarily unavailable.')
      setReport((previous) => ({ ...previous, ai_explanation: next }))
    } catch (failure) { if (version === insightVersion.current) setInsightError(failure.message) }
    finally { if (version === insightVersion.current) setInsightBusy(false) }
  }
  const verdictTone = report ? classificationTone(report.risk_classification) : 'neutral'
  const configurationCount = report?.findings.filter((finding) => finding.kind === 'security_configuration').length || 0
  const tabs = [['overview', 'Overview'], ['checks', 'Checks'], ['connection', 'Connection'], ['evidence', 'Evidence']]
  const activate = (name, focus = false) => {
    setTab(name)
    if (panels.current) panels.current.scrollTop = 0
    if (focus) dialog.current.querySelector(`#report-tab-${name}`).focus()
  }
  const navigateTab = (event, index) => {
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
      : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
      : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null
    if (next !== null) { event.preventDefault(); activate(tabs[next][0], true) }
  }
  return <dialog className="drawer report-drawer" ref={dialog} aria-label="Scan details" onCancel={onClose}>
    <div className="drawer__head analysis-header"><div className="report-header-title"><span className="report-header-symbol"><FileIcon /></span><div><p className="analysis-eyebrow">INVESTIGATION WORKSPACE</p><h2 className="drawer__title">Investigation report</h2></div></div><div className="report-header-actions">{report && <button className="btn btn--ghost" aria-label="Export report JSON" onClick={() => downloadReport(report)}><DownloadIcon /><span>Export report JSON</span></button>}<button className="icon-btn report-close" onClick={onClose} aria-label="Close report"><CloseIcon /></button></div></div>
    {!report && !error && <div className="analysis-loading"><p role="status">Loading saved report?</p><span /><span /><span /></div>}
    {error && <div role="alert" className="analysis-error"><AlertIcon /><p>{error}</p><button className="btn btn--ink" onClick={() => setAttempt((value) => value + 1)}>Retry report</button></div>}
    {report && <>
      <div className="report-summary rsum">
        <div className="rsum__site"><SiteIcon url={report.normalized_url} size={22} /><div><p className="report-url">{report.normalized_url}</p><p className="caption grey">Investigated {formatDate(report.created_at)} · <span className="rsum__id">Report {report.id}</span></p></div></div>
        <div className="rsum__row">
          <span className="rsum__verdict" data-tone={verdictTone}>{verdictTone === 'bad' || verdictTone === 'warn' ? <AlertIcon /> : verdictTone === 'ok' ? <ShieldIcon /> : <InfoIcon />}{report.risk_classification}</span>
          <div className="rsum__jumps" aria-label="Report summary">
            <button type="button" className="rsum__jump" onClick={() => activate('overview')}><b>{report.findings.length}</b>Findings</button>
            <button type="button" className="rsum__jump" onClick={() => activate('checks')}><b>{configurationCount}</b>Config warnings</button>
            <button type="button" className="rsum__jump" onClick={() => activate('connection')}><b>{report.redirect_chain.length}</b>Requests</button>
          </div>
        </div>
        {report.risk_classification === 'Inconclusive' && <div className="rsum__why"><InfoIcon /><div><strong>{inconclusiveReason(report)}</strong><p>We found no proof either way, so this link is unverified, not safe. Do not enter passwords, OTPs or payment details until you confirm the address through the organisation's official website.</p></div></div>}
      </div>
      <div className="report-tabs" role="tablist" aria-label="Report sections">{tabs.map(([name, title], index) => <button key={name} id={`report-tab-${name}`} role="tab" aria-selected={tab === name} aria-controls={`report-panel-${name}`} tabIndex={tab === name ? 0 : -1} onClick={() => activate(name)} onKeyDown={(event) => navigateTab(event, index)}><TabIcon name={name} />{title}{name === 'overview' && <span className="report-tab-count">{report.findings.length}</span>}</button>)}<span className="report-tabs-note">Read-only evidence report</span></div>
      <div className="report-panels" ref={panels}>
        <div className="report-panel report-overview" role="tabpanel" id="report-panel-overview" aria-labelledby="report-tab-overview" hidden={tab !== 'overview'}>
          <div className="report-overview-main">
      <section><SectionTitle icon={ShieldIcon} detail={`${report.findings.length} recorded`}>Findings</SectionTitle>
        {!report.findings.length && <p className="caption grey">No findings recorded. Review coverage before drawing conclusions.</p>}
        {report.findings.map((finding) => <article className="report-item analysis-finding" key={finding.id} data-severity={finding.severity}>
          <div className="analysis-finding-head"><span className="analysis-category-icon">{finding.kind === 'security_configuration' ? <SettingsIcon /> : <ShieldIcon />}</span><strong>{finding.description}</strong><span className="analysis-severity">{finding.severity}</span></div><p className="caption grey">{finding.kind?.replaceAll('_', ' ') || finding.category} · {finding.source} · {formatDate(finding.observed_at)}</p>
          {finding.impact && <p className="report-finding-context"><strong>Impact</strong>{finding.impact}</p>}
          {finding.remediation && <p className="report-finding-context"><strong>Recommended action</strong>{finding.remediation}</p>}
          <Evidence value={finding.evidence} />
        </article>)}
      </section>
      <section className="analysis-explanation" aria-busy={insightBusy}><div className="report-insight-head"><SectionTitle icon={FileIcon}>Report insights</SectionTitle>{!currentAI && <button className="btn btn--ink" disabled={insightBusy} onClick={generateInsights}>{insightBusy ? 'Analysing evidence…' : insightError ? 'Retry AI insights' : isAI ? 'Update AI insights' : 'Generate AI insights'}</button>}</div>
        {!isAI && <p className="caption grey">Get a concise Gemini interpretation of the findings and the most useful next steps. Only selected report evidence is sent.</p>}
        {insightBusy && <p className="report-insight-status" role="status">Preparing a short, evidence-based assessment…</p>}
        {insightError && <p className="report-insight-error" role="alert">{insightError} Your original findings remain available.</p>}
        {explanation?.status === 'completed' ? <>
          <div className="report-insight-summary"><p className="analysis-eyebrow">{isAI ? 'GEMINI ASSESSMENT' : 'ASSESSMENT SUMMARY'}</p><ExplanationText item={explanation.summary} evidence={explanation.evidence || []} /></div>
          {isAI ? <><div className="report-insight-grid">{[["What matters", explanation.explanations], ["What to do next", explanation.next_steps]].map(([title, items]) => <div key={title}><h4>{title}</h4>{items.map((item, index) => <ExplanationText key={index} item={item} evidence={explanation.evidence || []} />)}</div>)}</div><p className="caption grey">{explanation.model} · Saved {formatDate(explanation.generated_at)} · AI interpretation; review the cited evidence.</p></> : [["What the checks mean", explanation.explanations], ["What to do next", explanation.next_steps]].map(([title, items]) => <details key={title} className="report-group"><summary>{title}</summary>{items.map((item, index) => <ExplanationText key={index} item={item} evidence={explanation.evidence || []} />)}</details>)}
        </> : <p className="caption grey">{explanation?.reason || 'No explanation was saved with this report. Review the findings and check details below.'}</p>}
      </section>
          </div><aside className="report-overview-side" aria-label="Actions and assessment scope">
      <section><SectionTitle icon={CheckIcon}>Recommended actions</SectionTitle><ul className="analysis-actions">{!report.recommendations.length && <li><InfoIcon /><span>No specific remediation was identified. Review the report limitations before sharing sensitive information.</span></li>}{report.recommendations.map((text) => <li key={text}><CheckIcon /><span>{text}</span></li>)}</ul></section>
      <section className="analysis-limitations"><SectionTitle icon={InfoIcon}>Limitations</SectionTitle><ul className="drawer__list">{report.limitations.map((text) => <li key={text}>{text}</li>)}</ul></section>
          </aside>
        </div>
        <div className="report-panel" role="tabpanel" id="report-panel-checks" aria-labelledby="report-tab-checks" hidden={tab !== 'checks'}>
      <section><SectionTitle icon={CheckIcon}>Coverage</SectionTitle><div className="analysis-availability"><span><GlobeIcon />Network inspection: {report.evidence_coverage?.network_complete ? 'Complete' : 'Incomplete'}</span><span><ShieldIcon />Threat intelligence: {report.evidence_coverage?.reputation_available ? 'Available' : 'Unavailable'}</span></div><Coverage coverage={report.evidence_coverage} /><p className="analysis-caution"><InfoIcon />No detected threats does not guarantee safety.</p></section>
      {report.page_analysis && <section><SectionTitle icon={FileIcon}>Page inspection</SectionTitle><dl className="page-inspection-summary"><div><dt>Page title</dt><dd>{report.page_analysis.title || 'No title declared'}</dd></div><div><dt>Forms found</dt><dd>{report.page_analysis.form_count}</dd></div><div><dt>Mixed-content references</dt><dd>{report.page_analysis.mixed_content.length}</dd></div><div><dt>HTML refresh redirects</dt><dd>{report.page_analysis.meta_refreshes.length}</dd></div></dl><p className="caption grey">Static HTML only. No scripts, form submissions, or linked resources were executed.</p><Evidence title="Forms & page observations" value={report.page_analysis} /></section>}
      <section><SectionTitle icon={CheckIcon} detail={`${report.checks.length} checks`}>Individual checks</SectionTitle>
        <div className="rt-wrap"><table className="rt">
          <thead><tr><th>Check</th><th>Status</th><th>Result</th></tr></thead>
          <tbody>{report.checks.map((check, index) => <tr key={index} data-tone={stateTone(check.status)}>
            <td className="rt__name">{label(check.name)}</td>
            <td><span className="rt__pill" data-tone={stateTone(check.status)}><StateIcon state={check.status} />{check.status.replaceAll('_', ' ')}</span></td>
            <td className="rt__detail">{(check.reason || check.error) && <p>{check.reason || check.error}</p>}<Evidence title="Details" value={check} /></td>
          </tr>)}</tbody>
        </table></div>
      </section>
        </div>
        <div className="report-panel" role="tabpanel" id="report-panel-connection" aria-labelledby="report-tab-connection" hidden={tab !== 'connection'}>
      {!!report.url_analysis?.length && <section><SectionTitle icon={GlobeIcon}>Domain identity</SectionTitle>
        <div className="rt-wrap"><table className="rt">
          <thead><tr><th>Host</th><th>Registrable domain</th><th>Public suffix</th><th>Subdomain</th></tr></thead>
          <tbody>{report.url_analysis.map((domain) => <tr key={domain.url}>
            <td className="rt__name"><span className="url-cell"><SiteIcon url={domain.hostname} size={16} className="site-icon--sm" /><span>{domain.hostname}</span></span>{domain.unicode_hostname !== domain.hostname && <p className="caption grey">Unicode: {domain.unicode_hostname}</p>}</td>
            <td>{domain.registrable_domain || 'Not determined'}</td><td>{domain.suffix || 'Not determined'}</td><td>{domain.subdomain || 'None'}</td>
          </tr>)}</tbody>
        </table></div>
      </section>}
      <section><SectionTitle icon={RouteIcon}>Redirects & TLS</SectionTitle>
        {!report.redirect_chain.length && <p className="caption grey">No HTTP response collected. Check DNS, TLS, and destination policy results.</p>}
        {!!report.redirect_chain.length && <div className="rt-wrap"><table className="rt">
          <thead><tr><th aria-label="Step"></th><th>URL</th><th>Status</th><th>IP address</th><th>Connection</th></tr></thead>
          <tbody>{report.redirect_chain.map((hop, index) => <tr key={index}>
            <td className="rt__num"><HopIcon status={hop.status} /></td>
            <td className="rt__url"><span className="url-cell"><SiteIcon url={hop.url} size={16} className="site-icon--sm" /><span>{hop.url}</span></span></td>
            <td><span className="rt__pill" data-tone={hop.status >= 400 ? 'bad' : hop.status >= 300 ? 'warn' : 'ok'}>{hop.status}</span></td>
            <td className="rt__mono">{hop.address || '—'}</td>
            <td>{hop.tls ? <span className="rt__tls"><LockIcon />{hop.tls.protocol || 'TLS'}{hop.tls.not_after ? <em>expires {hop.tls.not_after}</em> : null}</span> : <span className="rt__pill" data-tone="warn">HTTP, no TLS</span>}</td>
          </tr>)}</tbody>
        </table></div>}
        {report.redirect_chain.map((hop, index) => <div className="rt-more" key={index}>
          <p className="rt-more__t">Request {String(index + 1).padStart(2, '0')} details</p>
          {hop.tls && <Evidence title="Certificate & TLS details" value={hop.tls} />}
          <Evidence title="Response headers" value={hop.headers} />
        </div>)}
      </section>
        </div>
        <div className="report-panel" role="tabpanel" id="report-panel-evidence" aria-labelledby="report-tab-evidence" hidden={tab !== 'evidence'}>
          <SectionTitle icon={FileIcon}>Source evidence</SectionTitle>
          <p className="report-panel-intro">Original observations and decision rules, preserved for review and export.</p>
          {report.assessment && <Evidence title="Assessment decision" value={report.assessment} />}
          {report.evidence_coverage?.checks && <Evidence title="Completed, incomplete & unimplemented checks" value={report.evidence_coverage.checks} />}
          {report.url_analysis && <Evidence title="Domain identity & URL indicators" value={report.url_analysis} />}
          {report.page_analysis && <Evidence title="Static page analysis" value={report.page_analysis} />}
          <Evidence title="Full report JSON" value={report} />
        </div>
      </div>
      <div className="report-bottom-bar"><span><InfoIcon />Automated checks do not guarantee website safety.</span><span>Saved investigation</span></div>
    </>}
  </dialog>
}
