'use client'

import { useState } from 'react'
import { getSupabase } from '../../lib/auth.js'
import { Badge } from '../../components/Sections.jsx'
import { PageHead } from './ui.jsx'

const MAX = 10000
const SAMPLES = [
  'Dear customer, your SBI KYC has expired. Update now at http://bit.ly/sbi-kyc or your account will be blocked today. Share the OTP sent to you.',
  'Congratulations! You are shortlisted for a work-from-home job. Pay ₹499 registration fee to confirm your seat.',
  'Hi, running 10 minutes late for the meeting. See you at the cafe.',
]

const tone = (level) => ({ High: 'bad', Medium: 'warn', Low: 'ok' })[level] || 'warn'

async function analyse(message, provider) {
  const { data } = await getSupabase().auth.getSession()
  if (!data.session) throw new Error('Your session has expired. Sign in again.')
  let res
  try {
    res = await fetch(`/api/analyze-message?provider=${provider}`, {
      method: 'POST', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
      body: JSON.stringify({ message }),
    })
  } catch { throw new Error('Cannot reach the analysis service. Check your connection and retry.') }
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    const d = json?.detail
    throw new Error(typeof d === 'string' ? d : Array.isArray(d) ? d.map((x) => x.msg).join(' ') : 'Analysis failed.')
  }
  return json
}

function Highlighted({ text, spans }) {
  if (!spans.length) return <p className="mx__quote">{text}</p>
  const escaped = spans.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).sort((a, b) => b.length - a.length)
  const parts = text.split(new RegExp(`(${escaped.join('|')})`, 'gi'))
  return (
    <p className="mx__quote">
      {parts.map((p, i) => (spans.some((s) => s.toLowerCase() === p.toLowerCase()) ? <mark key={i}>{p}</mark> : p))}
    </p>
  )
}

export default function Messages() {
  const [text, setText] = useState('')
  const [analysed, setAnalysed] = useState('')
  const [report, setReport] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [explaining, setExplaining] = useState(false)

  const run = async (e) => {
    e?.preventDefault()
    if (!text.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const r = await analyse(text, 'local')
      setReport(r)
      setAnalysed(text)
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }

  const explain = async () => {
    setExplaining(true)
    try {
      const r = await analyse(analysed, 'gemini')
      setReport((prev) => ({ ...prev, ai_explanation: r.ai_explanation }))
    } catch (failure) { setError(failure.message) }
    finally { setExplaining(false) }
  }

  const spans = report ? report.indicators.flatMap((i) => i.evidence) : []
  const ai = report?.ai_explanation

  return (
    <>
      <PageHead title="Messages" />

      <form className="card panel mx__in" onSubmit={run}>
        <div className="mx__in-head">
          <div>
            <h2 className="panel__title">Check a message</h2>
            <p className="caption grey">Paste an SMS, WhatsApp or email text. Links are extracted, not opened.</p>
          </div>
          <span className="caption grey mx__count">{text.length.toLocaleString()} / {MAX.toLocaleString()}</span>
        </div>
        <textarea
          className="mx__text"
          value={text}
          maxLength={MAX}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run() }}
          placeholder="e.g. Your KYC has expired. Update now at bit.ly/… and share the OTP."
          rows={6}
          aria-label="Message to analyse"
        />
        <div className="mx__in-foot">
          <div className="mx__samples">
            <span className="caption grey">Try:</span>
            {['KYC scam', 'Job offer', 'Normal text'].map((label, i) => (
              <button key={label} type="button" className="mx__chip" onClick={() => setText(SAMPLES[i])}>{label}</button>
            ))}
          </div>
          <div className="mx__actions">
            {text && <button type="button" className="btn btn--ghost" onClick={() => { setText(''); setReport(null); setError('') }}>Clear</button>}
            <button className="btn btn--ink" type="submit" disabled={busy || !text.trim()}>{busy ? 'Analysing…' : 'Analyse message'}</button>
          </div>
        </div>
        {error && <p className="dash__err mx__err" role="alert">{error}</p>}
      </form>

      {report && (
        <section className="mx__out" aria-live="polite">
          <div className={`card panel mx__verdict mx__verdict--${tone(report.risk_level)}`}>
            <div className="mx__v-main">
              <span className="caption grey">Assessment</span>
              <p className="mx__v-title">{report.classification}</p>
              <div className="mx__v-meta">
                <Badge tone={tone(report.risk_level)}>{report.risk_level} risk</Badge>
                {report.confidence != null && <span className="caption grey">Model confidence {Math.round(report.confidence * 100)}%</span>}
              </div>
            </div>
            <div className="mx__v-score">
              <span className="mx__v-n">{report.heuristic_risk_score}</span>
              <span className="caption grey">Indicator score</span>
              <span className="mx__v-bar"><span style={{ width: `${report.heuristic_risk_score}%` }} /></span>
            </div>
          </div>

          <div className="dash__grid">
            <div className="card panel">
              <div className="panel__head"><h2 className="panel__title">What we found</h2></div>
              <Highlighted text={analysed} spans={spans} />
              {report.indicators.length ? (
                <ul className="mx__ind">
                  {report.indicators.map((i) => (
                    <li key={i.code}>
                      <span className="mx__ind-dot" />
                      <div>
                        <p className="mx__ind-t">{i.name}</p>
                        <p className="caption grey">{i.evidence.join(' · ')}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <p className="caption grey mx__none">No scam indicators matched in this text.</p>}
            </div>

            <div className="card panel">
              <div className="panel__head"><h2 className="panel__title">Recommendation</h2></div>
              <p className="mx__rec">{report.recommendation}</p>
              {[['Links', report.extracted_urls], ['Phone numbers', report.extracted_phone_numbers], ['Email addresses', report.extracted_email_addresses]]
                .filter(([, v]) => v.length)
                .map(([label, values]) => (
                  <div key={label} className="mx__ext">
                    <p className="caption grey">{label}</p>
                    <div className="mx__tags">{values.map((v) => <code key={v}>{v}</code>)}</div>
                  </div>
                ))}
            </div>
          </div>

          <div className="card panel">
            <div className="panel__head">
              <div>
                <h2 className="panel__title">AI explanation</h2>
                <p className="caption grey">Gemini summarises the findings. Your message text is not sent.</p>
              </div>
              {!ai && <button className="btn btn--soft" onClick={explain} disabled={explaining}>{explaining ? 'Explaining…' : 'Explain with AI'}</button>}
            </div>
            {ai && (ai.status === 'unavailable'
              ? <p className="caption grey">{ai.reason}</p>
              : <div className="mx__ai">
                  {ai.summary && <p>{ai.summary}</p>}
                  {(ai.statements || ai.points || []).map((s, i) => <p key={i}>{s.text || s.statement || String(s)}</p>)}
                </div>)}
            {!ai && <p className="caption grey">{report.explanation}</p>}
          </div>

          <details className="mx__lim">
            <summary>Limitations</summary>
            <ul>{report.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
          </details>
        </section>
      )}
    </>
  )
}
