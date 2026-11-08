'use client'

import { useEffect, useState } from 'react'
import { BRAND } from '../../components/brandIcons.js'

// Settings → Connected accounts. Connects the user's own Gmail through the
// backend's OAuth endpoints (/api/email/gmail/*, proxied to FastAPI). The
// consent screen opens in a pop-up; the callback page posts the result back.

const GmailLogo = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d={BRAND.gmail.path} fill={BRAND.gmail.color} /></svg>
)

const KEY = (userId) => `wa-gmail:${userId || 'me'}`

export default function ConnectedAccounts({ userId }) {
  const [account, setAccount] = useState(null) // { email }
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  // Restore a previous connection and confirm it with the backend.
  useEffect(() => {
    let saved = null
    try { saved = JSON.parse(localStorage.getItem(KEY(userId))) } catch {}
    if (!saved?.email) return
    setAccount(saved)
    fetch(`/api/email/gmail/user?user_email=${encodeURIComponent(saved.email)}`)
      .then((r) => { if (r.status === 404) { setAccount(null); try { localStorage.removeItem(KEY(userId)) } catch {} } })
      .catch(() => {})
  }, [userId])

  // Result from the OAuth pop-up.
  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin || event.data?.type !== 'webassure:gmail-auth') return
      setBusy(false)
      if (event.data.status === 'success' && event.data.user?.email) {
        const next = { email: event.data.user.email, connectedAt: new Date().toISOString() }
        setAccount(next); setError(''); setNote('Gmail connected. You can now check inbox messages from Email analysis.')
        try { localStorage.setItem(KEY(userId), JSON.stringify(next)) } catch {}
      } else {
        setError('Gmail authorization was cancelled or failed. Please try again.')
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [userId])

  const connect = async () => {
    setBusy(true); setError(''); setNote('')
    try {
      const res = await fetch('/api/email/gmail/auth')
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.auth_url) throw new Error(data?.detail || 'Gmail connection is not available yet. The email service may not be running or configured.')
      const popup = window.open(data.auth_url, 'webassure-gmail-auth', 'width=520,height=680')
      if (!popup) throw new Error('Your browser blocked the sign-in window. Allow pop-ups for this site and try again.')
    } catch (failure) {
      setBusy(false); setError(failure.message)
    }
  }

  const disconnect = async () => {
    if (!account) return
    setBusy(true); setError(''); setNote('')
    try {
      await fetch(`/api/email/gmail/disconnect?user_email=${encodeURIComponent(account.email)}`, { method: 'POST' })
    } catch {}
    try { localStorage.removeItem(KEY(userId)) } catch {}
    setAccount(null); setBusy(false); setNote('Gmail disconnected. WebAssure no longer has access to your inbox.')
  }

  return (
    <div className="st__card ca">
      <div className="ca__row">
        <span className="ca__logo"><GmailLogo /></span>
        <div className="ca__txt">
          <p className="st__t">Gmail</p>
          <p className="st__d">{account ? <>Connected as <b>{account.email}</b></> : 'Check suspicious emails straight from your inbox. Read-only access.'}</p>
        </div>
        {account
          ? <button className="btn btn--soft" disabled={busy} onClick={disconnect}>{busy ? 'Disconnecting…' : 'Disconnect'}</button>
          : <button className="btn btn--ink" disabled={busy} onClick={connect}>{busy ? 'Waiting for Google…' : 'Connect Gmail'}</button>}
      </div>
      {account && <p className="ca__status"><i />Active connection</p>}
      {note && <p className="ca__note" role="status">{note}</p>}
      {error && <p className="ca__note ca__note--bad" role="alert">{error}</p>}
      <ul className="ca__facts">
        <li>WebAssure only reads the messages you choose to check.</li>
        <li>You can disconnect at any time, here or in your Google account.</li>
      </ul>
    </div>
  )
}
