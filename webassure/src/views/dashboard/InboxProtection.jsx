'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { emailLabel, emailTone } from '../../lib/email.js'
import { gmailStatus, latestScan, scanInbox } from '../../lib/gmail.js'
import { BRAND } from '../../components/brandIcons.js'

// Email analysis page: the connected inbox, its flagged emails and links to their saved reports.
export default function InboxProtection({ onOpen, onScanned }) {
  const [state, setState] = useState('loading')
  const [account, setAccount] = useState(null)
  const [scan, setScan] = useState(() => latestScan())
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    gmailStatus()
      .then((status) => { if (active) { setAccount(status.connected ? status : null); setState('ready') } })
      .catch(() => { if (active) setState('unavailable') })
    const onScan = (event) => { setScan(event.detail); onScanned?.() }
    window.addEventListener('wa-gmail-scan', onScan)
    return () => { active = false; window.removeEventListener('wa-gmail-scan', onScan) }
  }, [onScanned])

  const check = async () => {
    setChecking(true); setError('')
    try { await scanInbox() } catch (failure) { setError(failure.message) } finally { setChecking(false) }
  }

  if (state !== 'ready') return null
  if (!account) {
    return (
      <section className="card panel ea-inbox ea-inbox--off">
        <div><h2 className="panel__title">Protect your inbox</h2><p className="caption grey">Connect Gmail to get warned about likely fraud emails as they arrive.</p></div>
        <Link href="/dashboard/settings#accounts" className="ea-gmail-btn">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d={BRAND.gmail.path} fill={BRAND.gmail.color} /></svg>
          Connect Gmail
        </Link>
      </section>
    )
  }

  const flagged = scan?.flagged || []
  return (
    <section className="card panel ea-inbox" aria-label="Inbox protection">
      <div className="ea-inbox__head">
        <div>
          <h2 className="panel__title">Inbox protection <span className="ca__badge"><i />On</span></h2>
          <p className="caption grey">{account.email}{scan ? `, ${scan.scanned} latest emails checked` : ''}</p>
        </div>
        <button type="button" className="btn btn--ghost" disabled={checking} onClick={check}>{checking ? 'Checking…' : 'Check inbox now'}</button>
      </div>
      {error && <p className="ca__note ca__note--bad" role="alert">{error}</p>}
      {scan && !flagged.length && !error && <p className="caption grey">No fraud indicators found in these emails. This does not guarantee they are safe.</p>}
      {flagged.length > 0 && (
        <ul className="ca__flagged">
          {flagged.map((item) => (
            <li key={item.id}>
              <div className="ca__flag-top">
                <span className={`ca__tag ca__tag--${emailTone(item.classification)}`}>{emailLabel(item.classification)}</span>
                <button type="button" className="ea-inbox__open" onClick={() => onOpen(item.report_id)}>View report</button>
              </div>
              <p className="ca__subject">{item.subject}</p>
              <p className="ca__from">{item.from}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
