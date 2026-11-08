'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { emailLabel } from '../../lib/email.js'
import { FRAUD, dismissAlerts, dismissedAlerts, gmailLink, gmailStatus, scanInbox } from '../../lib/gmail.js'

const RESCAN_MS = 5 * 60 * 1000

// Dashboard-wide security layer: warns when a connected inbox receives likely fraud.
export default function GmailGuard({ userId }) {
  const [alerts, setAlerts] = useState([])
  const [email, setEmail] = useState('')
  const close = useRef(null)

  const run = useCallback(async () => {
    if (document.visibilityState === 'hidden') return
    try {
      const status = await gmailStatus()
      if (status.connected) await scanInbox()
    } catch {} // Background protection stays quiet; Settings shows connection problems.
  }, [])

  useEffect(() => {
    const onScan = (event) => {
      const result = event.detail
      const dismissed = dismissedAlerts(userId)
      setEmail(result?.email || '')
      setAlerts((result?.flagged || []).filter((item) => FRAUD.has(item.classification) && !dismissed.has(item.id)))
    }
    window.addEventListener('wa-gmail-scan', onScan)
    window.addEventListener('wa-gmail-connected', run)
    run()
    const timer = setInterval(run, RESCAN_MS)
    return () => {
      window.removeEventListener('wa-gmail-scan', onScan)
      window.removeEventListener('wa-gmail-connected', run)
      clearInterval(timer)
    }
  }, [run, userId])

  const dismiss = useCallback(() => {
    setAlerts((current) => { dismissAlerts(userId, current.map((item) => item.id)); return [] })
  }, [userId])

  const open = alerts.length > 0
  useEffect(() => {
    if (!open) return undefined
    close.current?.focus()
    const onKey = (event) => { if (event.key === 'Escape') dismiss() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, dismiss])

  if (!open) return null
  const shown = alerts.slice(0, 4)
  return (
    <div className="gg" role="alertdialog" aria-modal="true" aria-labelledby="gg-title" aria-describedby="gg-desc">
      <div className="gg__panel">
        <span className="gg__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 4.5 6v5.5c0 4.6 3.1 7.9 7.5 9.5 4.4-1.6 7.5-4.9 7.5-9.5V6L12 3Z" /><path d="M12 8.5v4M12 16h.01" /></svg>
        </span>
        <h2 id="gg-title" className="gg__title">{alerts.length === 1 ? 'Possible fraud email in your inbox' : `${alerts.length} possible fraud emails in your inbox`}</h2>
        <p id="gg-desc" className="gg__desc">Don&apos;t click links, open attachments or reply until you have verified the sender.</p>
        <ul className="gg__list">
          {shown.map((item) => (
            <li key={item.id} className="gg__item">
              <div className="gg__meta"><span className="gg__tag">{emailLabel(item.classification)}</span><span className="gg__links"><Link href={`/dashboard/email-analysis?report=${item.report_id}`} onClick={dismiss}>View report</Link><a href={gmailLink(item.id, email)} target="_blank" rel="noopener noreferrer">Open in Gmail</a></span></div>
              <p className="gg__subject">{item.subject}</p>
              <p className="gg__from">{item.from}</p>
              {item.reasons?.[0] && <p className="gg__reason">{item.reasons[0]}</p>}
            </li>
          ))}
        </ul>
        {alerts.length > shown.length && <p className="gg__more">And {alerts.length - shown.length} more in Settings, under Connected accounts.</p>}
        <div className="gg__foot">
          <p>Automated indicators, not proof of fraud.</p>
          <button ref={close} type="button" className="btn btn--ink" onClick={dismiss}>Got it</button>
        </div>
      </div>
    </div>
  )
}
