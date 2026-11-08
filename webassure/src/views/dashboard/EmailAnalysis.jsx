'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge } from '../../components/Sections.jsx'
import { classificationTone, downloadReport, formatDate } from '../../lib/investigations.js'
import { emailApi, emailLabel, emailTone, MAX_EMAIL_BYTES } from '../../lib/email.js'
import { PageHead, Tabs, Empty } from './ui.jsx'
import { useDash } from './context.js'
import { AlertIcon, CheckIcon, DownloadIcon, FileIcon, GlobeIcon, InfoIcon, MailIcon, ShieldIcon } from '../../components/Icons.jsx'

const SAMPLE = 'From: Account Security <security@account-review.example>\nReply-To: claims@unrelated.example\nSubject: Urgent account verification\n\nYour account will be blocked today. Reply with your password and OTP immediately. Pay a verification fee to restore access.'

function SectionTitle({ icon: Icon, children, detail }) {
  return (
    <div className="analysis-section-title">
      <Icon />
      <h3>{children}</h3>
      {detail && <span>{detail}</span>}
    </div>
  )
}

function EmailReport({ report }) {
  const ai = report.ai_explanation
  const tone = emailTone(report.classification)
  return (
    <section className="ea-result" aria-label="Email analysis results" aria-live="polite">

      {/* Verdict header */}
      <div className="card panel ea-verdict">
        <div className="ea-verdict__main">
          <p className="analysis-eyebrow">EMAIL ASSESSMENT</p>
          <h2 data-tone={tone}>{emailLabel(report.classification)}</h2>
          <p className="ea-verdict__subject">{report.subject || '(No subject)'}</p>
          <p className="caption grey">{report.sender || 'Sender not provided'} · {formatDate(report.analyzed_at)}</p>
        </div>
        <div className="ea-verdict__score">
          <strong className="ea-score-num">{report.risk_score}<small>/100</small></strong>
          <span className="caption grey">Indicator score, not a fraud probability</span>
          <Badge tone={tone}>{report.classification === 'SAFE' ? 'No significant indicators' : report.classification}</Badge>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="ea-layout">
        <div className="ea-layout__main">

          {/* Indicators */}
          <section className="card panel">
            <SectionTitle icon={ShieldIcon} detail={`${report.indicators.length} recorded`}>Indicators found</SectionTitle>
            {report.indicators.length ? report.indicators.map((item, i) => (
              <article key={i} className="report-item analysis-finding" data-severity={item.severity}>
                <div className="analysis-finding-head">
                  <span className="analysis-category-icon"><AlertIcon /></span>
                  <strong>{item.type.replaceAll('_', ' ')}</strong>
                  <span className="analysis-severity">{item.severity}</span>
                </div>
                <p>{item.evidence}</p>
              </article>
            )) : <p className="caption grey">No significant indicators matched. This does not establish that the sender or email is legitimate.</p>}
          </section>

          {/* Auth table */}
          <section className="card panel">
            <SectionTitle icon={ShieldIcon}>Email authentication</SectionTitle>
            <p className="caption grey">Results are read from the supplied headers, which can be edited or forged. Missing evidence is not a failure.</p>
            <div className="rt-wrap">
              <table className="rt">
                <thead><tr><th>Protocol</th><th>Result</th></tr></thead>
                <tbody>
                  {['spf', 'dkim', 'dmarc'].map((name) => {
                    const present = report.authentication.evidence_present?.[name]
                    const status = present ? report.authentication[name] : 'Not provided'
                    const authTone = !present ? 'neutral' : status === 'PASS' ? 'ok' : ['FAIL', 'SOFTFAIL'].includes(status) ? 'bad' : 'neutral'
                    return (
                      <tr key={name}>
                        <td className="rt__name">{name.toUpperCase()}</td>
                        <td><span className="rt__pill" data-tone={authTone}>{status}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {!!report.authentication.details?.length && (
              <details className="report-evidence">
                <summary>Authentication observations</summary>
                <ul className="analysis-actions">
                  {report.authentication.details.map((text, i) => <li key={i}><InfoIcon /><span>{text}</span></li>)}
                </ul>
              </details>
            )}
          </section>

          {/* Links table */}
          <section className="card panel">
            <SectionTitle icon={GlobeIcon}>Links found in the email</SectionTitle>
            <p className="caption grey">The backend inspects extracted links. Displayed links are text; nothing opens in your browser.</p>
            {report.urls.length ? (
              <div className="rt-wrap">
                <table className="rt">
                  <thead><tr><th>URL</th><th>Assessment</th></tr></thead>
                  <tbody>
                    {report.urls.map((item, i) => (
                      <tr key={i}>
                        <td className="rt__url"><code>{item.url}</code></td>
                        <td><span className="rt__pill" data-tone={classificationTone(item.risk_classification)}>{item.risk_classification}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="caption grey">No links were extracted.</p>}
          </section>

          {/* Attachments */}
          {!!report.attachments.length && (
            <section className="card panel">
              <SectionTitle icon={FileIcon}>Attachments</SectionTitle>
              <p className="caption grey">Metadata inspection only. Files are not executed or scanned for malware.</p>
              <div className="rt-wrap">
                <table className="rt">
                  <thead><tr><th>File</th><th>Type</th><th>Risk</th></tr></thead>
                  <tbody>
                    {report.attachments.map((item, i) => (
                      <tr key={i}>
                        <td className="rt__name"><strong>{item.filename}</strong><p className="caption grey">{item.size.toLocaleString()} bytes</p></td>
                        <td className="rt__mono">{item.content_type}</td>
                        <td><span className="rt__pill" data-tone={item.risk_level === 'HIGH' ? 'bad' : item.risk_level === 'MEDIUM' ? 'warn' : 'neutral'}>{item.risk_level} risk</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* AI / Explanation */}
          <section className="card panel">
            <SectionTitle icon={FileIcon}>{ai?.provider === 'Gemini' ? 'AI insights' : 'Assessment explanation'}</SectionTitle>
            {ai?.status === 'completed' ? (
              <>
                <div className="report-insight-summary">
                  <p className="analysis-eyebrow">{ai.provider === 'Gemini' ? 'GEMINI ASSESSMENT' : 'ASSESSMENT SUMMARY'}</p>
                  <p>{ai.summary?.text}</p>
                </div>
                {!!ai.explanations?.length && (
                  <details className="report-evidence">
                    <summary>What the findings mean</summary>
                    {ai.explanations.map((item, i) => <p className="ea-explanation" key={i}>{item.text}</p>)}
                  </details>
                )}
                <p className="caption grey">{ai.provider} · {ai.model}</p>
              </>
            ) : <p className="caption grey">{ai?.reason || 'The optional AI explanation is unavailable. The original findings remain available.'}</p>}
          </section>

          {/* Evidence collapsible */}
          <details className="card panel report-evidence">
            <summary>Limitations and supporting evidence</summary>
            <ul className="analysis-actions">
              {report.limitations.map((text, i) => <li key={i}><InfoIcon /><span>{text}</span></li>)}
            </ul>
            <details className="report-evidence">
              <summary>Sender and scoring evidence</summary>
              <pre>{JSON.stringify({ sender_analysis: report.sender_analysis, risk_scoring: report.risk_scoring }, null, 2)}</pre>
            </details>
          </details>

        </div>

        <aside className="ea-layout__side">

          {/* Recommended actions */}
          <section className="card panel">
            <SectionTitle icon={CheckIcon}>Recommended actions</SectionTitle>
            <ul className="analysis-actions">
              {report.recommendations.map((text, i) => <li key={i}><CheckIcon /><span>{text}</span></li>)}
            </ul>
          </section>

          {/* Export */}
          <div className="card panel ea-export">
            <p className="caption grey">Export contains email metadata and evidence. Share only with intended recipients.</p>
            <button className="btn btn--ghost" onClick={() => downloadReport(report)}><DownloadIcon /><span>Export report</span></button>
          </div>

        </aside>
      </div>
    </section>
  )
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

    <form className="card panel ea-input" onSubmit={submit}>
      <div className="ea-input__head">
        <SectionTitle icon={MailIcon}>Check an email</SectionTitle>
        <p className="caption grey">Paste the original message with headers, inspect headers alone, or upload an .eml file. Results are saved privately to your signed-in account.</p>
      </div>
      <Tabs value={mode} onChange={(value) => { if (!busy) { setMode(value); setError('') } }} options={[["email", 'Paste email'], ['headers', 'Raw headers'], ['file', 'Upload .eml']]} />
      {mode === 'file' ? <label className="email-file">Choose an .eml file<input type="file" accept=".eml,message/rfc822" aria-label="Email file" disabled={busy} onChange={(event) => setFile(event.target.files?.[0] || null)} /><span className="caption grey">{file ? `${file.name} · ${file.size.toLocaleString()} bytes` : 'Maximum 500 KB. Attachments are assessed by metadata only.'}</span></label> : <><label className="email-text-label" htmlFor="email-content">{mode === 'headers' ? 'Raw email headers' : 'Original email content'}</label><textarea id="email-content" className="mx__text" rows={9} value={text} disabled={busy} maxLength={MAX_EMAIL_BYTES} onChange={(event) => setText(event.target.value)} placeholder={mode === 'headers' ? 'From: sender@example.com\nReply-To: …\nAuthentication-Results: …' : 'From: sender@example.com\nSubject: …\n\nPaste the email body here…'} /><span className="caption grey">{bytes.toLocaleString()} / 500,000 bytes</span></>}
      <div className="ea-input__foot">
        {mode === 'email' && <button className="btn btn--ghost" type="button" disabled={busy} onClick={() => setText(SAMPLE)}>Try scam sample</button>}
        <label className="ea-ai-opt"><input type="checkbox" checked={useGemini} disabled={busy} onChange={(event) => setUseGemini(event.target.checked)} />Include Gemini insights</label>
        <button className="btn btn--ink" disabled={busy || (mode === 'file' ? !file : !text.trim() || bytes > MAX_EMAIL_BYTES)}>{busy ? 'Analysing…' : 'Analyse email'}</button>
      </div>
      <p className="caption grey">Extracted links are inspected by the backend. Analysis may take longer for messages with several links. {useGemini ? 'Selected findings and evidence snippets will also be shared with Gemini.' : 'Gemini is off; no AI tokens are used.'}</p>
      {busy && <p role="status">Processing the email report…</p>}
      {error && <p className="dash__err" role="alert">{error}</p>}
    </form>

    {report && <EmailReport report={report} />}

    <section className="card panel ea-history">
      <div className="ea-history__head">
        <SectionTitle icon={FileIcon}>Saved email analyses</SectionTitle>
        <button className="ea-reload-btn" disabled={historyLoading || busy} onClick={() => loadHistory()} aria-label="Refresh email history">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 4v6h6M23 20v-6h-6" />
            <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
          </svg>
          <span>Refresh</span>
        </button>
      </div>
      {historyError && <p role="alert" className="caption" style={{ color: 'var(--st-bad)' }}>{historyError}</p>}
      {historyLoading && <p role="status" className="caption grey">Loading saved results…</p>}
      {history.length ? <>
        <div className="rt-wrap">
          <table className="rt">
            <thead><tr><th>Subject / sender</th><th>Assessment</th><th>Analysed</th><th></th></tr></thead>
            <tbody>{history.map((item) => (
              <tr key={item.id}>
                <td><strong>{item.subject || '(No subject)'}</strong><p className="caption grey">{item.sender || 'Sender not provided'}</p></td>
                <td><span className="rt__pill" data-tone={emailTone(item.classification)}>{emailLabel(item.classification)}</span></td>
                <td className="rt__mono">{formatDate(item.analyzed_at)}</td>
                <td><button className="btn btn--ghost" disabled={busy} onClick={() => openSaved(item.id)} aria-label={`Open email report ${item.subject || item.id}`}>Open</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <p className="caption grey">{history.length} of {total} saved analyses</p>
        {history.length < total && <button className="btn btn--ghost" disabled={historyLoading} onClick={() => loadHistory(history.length)}>Load more email reports</button>}
      </> : !historyLoading && !historyError && <Empty title="No saved email analyses" text="Analyse your first email to build your private history." />}
    </section>
  </>
}
