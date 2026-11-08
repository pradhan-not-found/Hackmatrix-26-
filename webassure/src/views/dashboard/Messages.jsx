'use client'

import { useState } from 'react'
import { getSupabase } from '../../lib/auth.js'
import { PageHead } from './ui.jsx'
import MessageReport from './MessageReport.jsx'

const MAX = 10000
const SAMPLES = [
  'Dear customer, your SBI KYC has expired. Update now at http://bit.ly/sbi-kyc or your account will be blocked today. Share the OTP sent to you.',
  'Congratulations! You are shortlisted for a work-from-home job. Pay ₹499 registration fee to confirm your seat.',
  'Hi, running 10 minutes late for the meeting. See you at the cafe.',
]

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
        <MessageReport report={report} text={analysed} onExplain={explain} explaining={explaining} />
      )}
    </>
  )
}
