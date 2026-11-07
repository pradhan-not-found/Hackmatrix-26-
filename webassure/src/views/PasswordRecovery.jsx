'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getUser, resetPassword, updatePassword } from '../lib/auth.js'

export default function PasswordRecovery({ reset = false }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(!reset)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!reset) return
    let active = true
    getUser().then((user) => {
      if (!active) return
      if (user) setReady(true)
      else setError('This reset link is invalid or expired. Request a new one.')
    }).catch((failure) => { if (active) setError(failure.message) })
    return () => { active = false }
  }, [reset])

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (reset && password.length < 8) return setError('Password must be at least 8 characters.')
    if (reset && password !== confirmation) return setError('Passwords do not match.')
    setBusy(true)
    try {
      if (reset) await updatePassword(password)
      else await resetPassword(email.trim())
      setPassword(''); setConfirmation(''); setDone(true)
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }
  return <main className="auth">
    <div className="auth__form-side"><div className="auth__box">
      <Link href="/" className="wordmark">webassure</Link>
      <h1 className="auth__title">{reset ? 'Choose a new password' : 'Reset your password'}</h1>
      {done ? <p role="status">{reset ? 'Your password has been updated.' : 'If an account matches that email, you will receive a reset link. Open it in this browser.'}</p> :
        <form className="auth__fields" onSubmit={submit}>
          {reset ? <>
            <label className="field"><span>New password</span><input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            <label className="field"><span>Confirm password</span><input type="password" autoComplete="new-password" required minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
          </> : <label className="field"><span>Email</span><input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>}
          <button className="btn btn--ink btn--block" disabled={busy || !ready}>{busy ? 'Please wait…' : reset ? 'Save password' : 'Send reset link'}</button>
        </form>}
      {error && <p className="auth__error" role="alert">{error}</p>}
      <p className="auth__switch"><Link href="/login">Back to sign in</Link>{reset && !ready && <> · <Link href="/forgot-password">Request a new link</Link></>}</p>
    </div></div>
    <aside className="auth__art" aria-hidden="true"><div className="auth__brand"><span className="auth__word">webassure</span><span className="auth__tag">Know your website before you trust it.</span></div></aside>
  </main>
}
