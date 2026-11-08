'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge } from '../../components/Sections.jsx'
import { classificationTone, downloadReport, formatDate } from '../../lib/investigations.js'
import { emailApi, emailLabel, emailTone, MAX_EMAIL_BYTES } from '../../lib/email.js'
import { PageHead, Tabs, Empty } from './ui.jsx'
import { useDash } from './context.js'

const SAMPLE = 'From: Account Security <security@account-review.example>\nReply-To: claims@unrelated.example\nSubject: Urgent account verification\n\nYour account will be blocked today. Reply with your password and OTP immediately. Pay a verification fee to restore access.'

function EmailReport({ report }) {
  const ai = report.ai_explanation
  return <section className="email-result" aria-label="Email analysis results" aria-live="polite">
    <div className="card panel email-verdict"><div><p className="analysis-eyebrow">EMAIL ASSESSMENT</p><h2>{emailLabel(report.classification)}</h2><p className="email-subject">{report.subject || '(No subject)'}</p><p className="caption grey">{report.sender || 'Sender not provided'} · {formatDate(report.analyzed_at)}</p></div><div className="email-score"><strong>{report.risk_score}<small>/100</small></strong><span className="caption grey">Indicator score, not a fraud probability</span><Badge tone={emailTone(report.classification)}>{report.classification === 'SAFE' ? 'No significant indicators' : report.classification}</Badge></div></div>
    <div className="email-result-grid"><section className="card panel"><h3 className="panel__title">What we found</h3>{report.indicators.length ? <ul className="email-findings">{report.indicators.map((item, index) => <li key={index}><div><strong>{item.type.replaceAll('_', ' ')}</strong><Badge tone={['HIGH', 'CRITICAL'].includes(item.severity) ? 'bad' : item.severity === 'MEDIUM' ? 'warn' : 'neutral'}>{item.severity}</Badge></div><p>{item.evidence}</p></li>)}</ul> : <p className="caption grey">No significant indicators matched. This does not establish that the sender or email is legitimate.</p>}</section><section className="card panel"><h3 className="panel__title">Recommended actions</h3><ul className="email-actions">{report.recommendations.map((text, index) => <li key={index}>{text}</li>)}</ul></section></div>
    <section className="card panel"><h3 className="panel__title">Reported email authentication</h3><p className="caption grey">Results are read from the supplied headers, which can be edited or forged. Signatures and sender identity are not independently verified. Missing evidence is not a failure.</p><div className="email-auth">{['spf', 'dkim', 'dmarc'].map((name) => { const present = report.authentication.evidence_present?.[name]; const status = present ? report.authentication[name] : 'Not provided'; return <div key={name}><strong>{name.toUpperCase()}</strong><Badge tone={!present ? 'neutral' : status === 'PASS' ? 'ok' : ['FAIL', 'SOFTFAIL'].includes(status) ? 'bad' : 'neutral'}>{status}</Badge></div> })}</div>{!!report.authentication.details?.length && <details><summary>Authentication observations</summary><ul className="email-actions">{report.authentication.details.map((text, index) => <li key={index}>{text}</li>)}</ul></details>}</section>
    <section className="card panel"><h3 className="panel__title">Links found in the email</h3><p className="caption grey">The backend inspects extracted links using the existing bounded URL scanner. Displayed links are text; nothing opens in your browser.</p>{report.urls.length ? <ul className="email-links">{report.urls.map((item, index) => <li key={index}><div><code>{item.url}</code><Badge tone={classificationTone(item.risk_classification)}>{item.risk_classification}</Badge></div>{item.error && <p className="caption grey">{item.error}</p>}{!!item.findings?.length && <details><summary>Link findings</summary><ul className="email-actions">{item.findings.map((finding, n) => <li key={n}>{finding.description}</li>)}</ul></details>}</li>)}</ul> : <p className="caption grey">No links were extracted.</p>}</section>
    {!!report.attachments.length && <section className="card panel"><h3 className="panel__title">Attachments</h3><p className="caption grey">Metadata inspection only. Files are not executed or scanned for malware.</p><ul className="email-links">{report.attachments.map((item, index) => <li key={index}><div><strong>{item.filename}</strong><Badge tone={item.risk_level === 'HIGH' ? 'bad' : item.risk_level === 'MEDIUM' ? 'warn' : 'neutral'}>{item.risk_level} metadata risk</Badge></div><p className="caption grey">{item.content_type} · {item.size.toLocaleString()} bytes</p>{item.risk_reasons.map((reason, n) => <p key={n}>{reason}</p>)}</li>)}</ul></section>}
    <section className="card panel"><h3 className="panel__title">{ai?.provider === 'Gemini' ? 'AI insights' : 'Assessment explanation'}</h3>{ai?.status === 'completed' ? <><p>{ai.summary?.text}</p>{!!ai.explanations?.length && <details><summary>What the findings mean</summary>{ai.explanations.map((item, index) => <p className="email-explanation" key={index}>{item.text}</p>)}</details>}<p className="caption grey">{ai.provider} · {ai.model}</p></> : <p className="caption grey">{ai?.reason || 'The optional AI explanation is unavailable. The original findings remain available.'}</p>}</section>
    <details className="card panel email-evidence"><summary>Limitations and supporting evidence</summary><ul className="email-actions">{report.limitations.map((text, index) => <li key={index}>{text}</li>)}</ul><details><summary>Sender and scoring evidence</summary><pre>{JSON.stringify({ sender_analysis: report.sender_analysis, risk_scoring: report.risk_scoring }, null, 2)}</pre></details></details>
    <div className="email-export"><p className="caption grey">Export contains email metadata and evidence. Share only with intended recipients.</p><button className="btn btn--ghost" onClick={() => downloadReport(report)}>Export email report</button></div>
  </section>
}

export default function EmailAnalysis() {
  const { user } = useDash()
  const [mode, setMode] = useState('email')
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [useGemini, setUseGemini] = useState(false)
  const [report, setReport] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])
  const [total, setTotal] = useState(0)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const epoch = useRef(0)
  const historyRequest = useRef(0)
  const bytes = new TextEncoder().encode(text).byteLength
  const loadHistory = useCallback(async (offset = 0) => {
    const version = epoch.current
    const request = ++historyRequest.current
    setHistoryLoading(true); setHistoryError('')
    try {
      const page = await emailApi(`results?limit=10&offset=${offset}`)
      if (version !== epoch.current || request !== historyRequest.current) return
      setHistory((previous) => offset ? [...new Map([...previous, ...page.items].map((item) => [item.id, item])).values()] : page.items)
      setTotal(page.total)
    } catch (failure) { if (version === epoch.current && request === historyRequest.current) setHistoryError(failure.message) }
    finally { if (version === epoch.current && request === historyRequest.current) setHistoryLoading(false) }
  }, [])
  useEffect(() => {
    ++epoch.current; setReport(null); setText(''); setFile(null); setError(''); setHistory([]); setTotal(0); setBusy(false)
    loadHistory()
    return () => { ++epoch.current }
  }, [user.id, loadHistory])
  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    const version = epoch.current
    setBusy(true); setError('')
    try {
      let result
      if (mode === 'file') {
        if (!file || !/\.eml$/i.test(file.name) || !file.size || file.size > MAX_EMAIL_BYTES) throw new Error('Choose a nonempty .eml file no larger than 500 KB.')
        const body = new FormData(); body.set('file', file); body.set('use_gemini', String(useGemini))
        result = await emailApi('upload', { method: 'POST', body })
      } else {
        if (!text.trim() || bytes > MAX_EMAIL_BYTES) throw new Error('Enter email content no larger than 500 KB.')
        result = await emailApi('analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [mode === 'headers' ? 'raw_headers' : 'email_content']: text, use_gemini: useGemini }) })
      }
      if (version !== epoch.current) return
      setReport(result); await loadHistory()
    } catch (failure) { if (version === epoch.current) setError(failure.message) }
    finally { if (version === epoch.current) setBusy(false) }
  }
  const openSaved = async (id) => {
    const version = epoch.current
    setBusy(true); setError('')
    try { const result = await emailApi(`results/${id}`); if (version === epoch.current) setReport(result) }
    catch (failure) { if (version === epoch.current) setError(failure.message) }
    finally { if (version === epoch.current) setBusy(false) }
  }
  return <>
    <PageHead title="Email analysis" sub="Inspect suspicious messages, sender details and email authentication evidence." />
    <form className="card panel email-input" onSubmit={submit}>
      <div><h2 className="panel__title">Check an email</h2><p className="caption grey">Paste the original message with headers, inspect headers alone, or upload an .eml file. Results are saved privately to your signed-in account on this backend.</p></div>
      <Tabs value={mode} onChange={(value) => { if (!busy) { setMode(value); setError('') } }} options={[["email", 'Paste email'], ['headers', 'Raw headers'], ['file', 'Upload .eml']]} />
      {mode === 'file' ? <label className="email-file">Choose an .eml file<input type="file" accept=".eml,message/rfc822" aria-label="Email file" disabled={busy} onChange={(event) => setFile(event.target.files?.[0] || null)} /><span className="caption grey">{file ? `${file.name} · ${file.size.toLocaleString()} bytes` : 'Maximum 500 KB. Attachments are assessed by metadata only.'}</span></label> : <><label className="email-text-label" htmlFor="email-content">{mode === 'headers' ? 'Raw email headers' : 'Original email content'}</label><textarea id="email-content" className="mx__text" rows={9} value={text} disabled={busy} maxLength={MAX_EMAIL_BYTES} onChange={(event) => setText(event.target.value)} placeholder={mode === 'headers' ? 'From: sender@example.com\nReply-To: …\nAuthentication-Results: …' : 'From: sender@example.com\nSubject: …\n\nPaste the email body here…'} /><span className="caption grey">{bytes.toLocaleString()} / 500,000 bytes</span></>}
      <div className="email-input-actions">{mode === 'email' && <button className="btn btn--ghost" type="button" disabled={busy} onClick={() => setText(SAMPLE)}>Try scam sample</button>}<label className="email-ai-option"><input type="checkbox" checked={useGemini} disabled={busy} onChange={(event) => setUseGemini(event.target.checked)} />Include Gemini insights</label><button className="btn btn--ink" disabled={busy || (mode === 'file' ? !file : !text.trim() || bytes > MAX_EMAIL_BYTES)}>{busy ? 'Analysing…' : 'Analyse email'}</button></div>
      <p className="caption grey">Extracted links are inspected by the backend. Analysis may take longer for messages with several links. {useGemini ? 'Selected findings and evidence snippets will also be shared with Gemini.' : 'Gemini is off; no AI tokens are used.'}</p>
      {busy && <p role="status">Processing the email report…</p>}{error && <p className="dash__err" role="alert">{error}</p>}
    </form>
    {report && <EmailReport report={report} />}
    <section className="card panel email-history"><div className="panel__head"><h2 className="panel__title">Saved email analyses</h2><button className="btn btn--ghost" disabled={historyLoading || busy} onClick={() => loadHistory()}>Refresh email history</button></div>{historyError && <p role="alert">{historyError}</p>}{historyLoading && <p role="status">Loading saved results…</p>}{history.length ? <><div className="table-wrap"><table className="table"><thead><tr><th>Subject / sender</th><th>Assessment</th><th>Analysed</th><th>Report</th></tr></thead><tbody>{history.map((item) => <tr key={item.id}><td><strong>{item.subject || '(No subject)'}</strong><p className="caption grey">{item.sender || 'Sender not provided'}</p></td><td><Badge tone={emailTone(item.classification)}>{emailLabel(item.classification)}</Badge></td><td>{formatDate(item.analyzed_at)}</td><td><button className="btn btn--ghost" disabled={busy} onClick={() => openSaved(item.id)} aria-label={`Open email report ${item.subject || item.id}`}>Open report</button></td></tr>)}</tbody></table></div><p className="caption grey">{history.length} of {total} saved analyses</p>{history.length < total && <button className="btn btn--ghost" disabled={historyLoading} onClick={() => loadHistory(history.length)}>Load more email reports</button>}</> : !historyLoading && !historyError && <Empty title="No saved email analyses" text="Analyse your first email to build your private history." />}</section>
  </>
}
