'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BRAND } from '../../components/brandIcons.js'
import { emailLabel, emailTone } from '../../lib/email.js'
import { announceGmailConnected, disconnectGmail, gmailAuthorize, gmailLink, gmailStatus, latestScan, scanInbox } from '../../lib/gmail.js'

// Settings → Connected accounts. The Google consent screen opens in a pop-up; this
// card polls the signed-in user's connection until the backend has stored it.

const GmailLogo = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d={BRAND.gmail.path} fill={BRAND.gmail.color} /></svg>
)

const POLL_MS = 2000
const POLL_LIMIT_MS = 3 * 60 * 1000

export default function ConnectedAccounts() {
  const [account, setAccount] = useState(null) // { email }
  const [loading, setLoading] = useState(true)
  const [waiting, setWaiting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [scan, setScan] = useState(() => latestScan())
  const [scanning, setScanning] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const poll = useRef(null)

  const stopPolling = useCallback(() => { clearInterval(poll.current); poll.current = null; setWaiting(false) }, [])

  const check = useCallback(async () => {
    setScanning(true); setError('')
    try { await scanInbox() } catch (failure) { setError(failure.message) } finally { setScanning(false) }
  }, [])

  useEffect(() => {
    let active = true
    gmailStatus()
      .then((status) => { if (active) setAccount(status.connected ? status : null) })
      .catch((failure) => { if (active) setError(failure.message) })
      .finally(() => { if (active) setLoading(false) })
    const onScan = (event) => setScan(event.detail)
    window.addEventListener('wa-gmail-scan', onScan)
    return () => { active = false; window.removeEventListener('wa-gmail-scan', onScan); clearInterval(poll.current) }
  }, [])

  const connect = async () => {
    setError(''); setNote('')
    // Opened before the request so the browser treats it as part of the click.
    const popup = window.open('', 'webassure-gmail-auth', 'width=520,height=680')
    if (!popup) { setError('Your browser blocked the sign-in window. Allow pop-ups for this site and try again.'); return }
    setWaiting(true)
    try {
      const { auth_url: url } = await gmailAuthorize()
      popup.location.href = url
    } catch (failure) {
      popup.close(); setWaiting(false); setError(failure.message); return
    }
    const started = Date.now()
    poll.current = setInterval(async () => {
      if (Date.now() - started > POLL_LIMIT_MS) {
        stopPolling(); setError('Google sign-in timed out. Please try again.'); return
      }
      try {
        const status = await gmailStatus()
        if (status.connected) {
          stopPolling(); setAccount(status)
          setNote('Gmail connected. Inbox protection is now on.')
          announceGmailConnected()
        }
      } catch {}
    }, POLL_MS)
  }

  const disconnect = async () => {
    setBusy(true); setError(''); setNote('')
    try {
      await disconnectGmail()
      setAccount(null); setScan(null); setNote('Gmail disconnected. WebAssure no longer has access to your inbox.')
    } catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }

  const flagged = scan?.flagged || []
  return (
    <div className="st__card ca">
      <div className="ca__row">
        <span className="ca__logo"><GmailLogo /></span>
        <div className="ca__txt">
          <p className="st__t">Gmail {account && <span className="ca__badge"><i />Connected</span>}</p>
          <p className="st__d">{account ? <>Protecting <b>{account.email}</b></> : 'Warn me about fraud emails arriving in my inbox. Read-only access.'}</p>
        </div>
        {account
          ? <button className="btn btn--soft" disabled={busy} onClick={disconnect}>{busy ? 'Disconnecting…' : 'Disconnect'}</button>
          : waiting
            ? <div className="ca__wait"><span>Waiting for Google…</span><button className="btn btn--soft" onClick={stopPolling}>Cancel</button></div>
            : <button className="btn btn--ink" disabled={loading} onClick={connect}>{loading ? 'Checking…' : 'Connect Gmail'}</button>}
      </div>
      {note && <p className="ca__note" role="status">{note}</p>}
      {error && <p className="ca__note ca__note--bad" role="alert">{error}</p>}

      {account && (
        <section className="ca__guard" aria-label="Inbox protection">
          <div className="ca__guard-head">
            <div>
              <p className="st__t">Inbox protection</p>
              <p className="st__d">{scan ? `${scan.scanned} latest emails checked at ${new Date(scan.checked_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}${scan.failed ? `, ${scan.failed} could not be read` : ''}` : 'Checks your latest emails while your dashboard is open.'}</p>
            </div>
            <button className="btn btn--ghost" disabled={scanning} onClick={check}>{scanning ? 'Checking…' : 'Check inbox now'}</button>
          </div>
          {scan && !flagged.length && !error && <p className="ca__clear">No fraud indicators found in these emails. This does not guarantee they are safe.</p>}
          {flagged.length > 0 && (
            <ul className="ca__flagged">
              {flagged.map((item) => (
                <li key={item.id}>
                  <div className="ca__flag-top">
                    <span className={`ca__tag ca__tag--${emailTone(item.classification)}`}>{emailLabel(item.classification)}</span>
                    <span className="gg__links"><Link href={`/dashboard/email-analysis?report=${item.report_id}`}>View report</Link><a href={gmailLink(item.id, scan.email)} target="_blank" rel="noopener noreferrer">Open in Gmail</a></span>
                  </div>
                  <p className="ca__subject">{item.subject}</p>
                  <p className="ca__from">{item.from}</p>
                  {item.reasons?.[0] && <p className="ca__reason">{item.reasons[0]}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <ul className="ca__facts">
        <li>WebAssure checks your 15 latest inbox emails while your dashboard is open, and warns you about likely fraud.</li>
        <li>Links are inspected without being opened. Full emails are not saved; reports for flagged emails appear in Email analysis.</li>
        <li>You can disconnect at any time, here or in your Google account.</li>
      </ul>
    </div>
  )
}
