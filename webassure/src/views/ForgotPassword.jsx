'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  // Demo flow: a real deployment would call the auth provider's reset endpoint here.
  const submit = (e) => {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.')
    setError('')
    setBusy(true)
    setTimeout(() => {
      setBusy(false)
      setSent(true)
    }, 700)
  }

  return (
    <div className="auth">
      <div className="auth__form-side">
        <div className="auth__box">
          {sent ? (
            <div className="fp__done">
              <span className="fp__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="14" rx="3" />
                  <path d="M4 7l8 6 8-6" />
                </svg>
              </span>
              <h1 className="auth__title">Check your email</h1>
              <p className="auth__sub grey">
                If an account exists for <b className="fp__email">{email}</b>, we&apos;ve sent a link to reset your password. It expires in 30 minutes.
              </p>
              <div className="auth__fields">
                <Link href="/login" className="btn btn--ink btn--block">Back to log in</Link>
                <button type="button" className="fp__resend" onClick={() => setSent(false)}>
                  Didn&apos;t get it? Try another email
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="auth__title">Reset your password</h1>
              <p className="auth__sub grey">Enter the email you signed up with and we&apos;ll send you a reset link.</p>
              <form onSubmit={submit} noValidate className="auth__fields fp__form">
                <label className="field">
                  <span>Work email</span>
                  <input type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
                </label>
                {error && <p className="auth__error" role="alert">{error}</p>}
                <button className="btn btn--ink btn--block" type="submit" disabled={busy}>
                  {busy ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
              <p className="auth__switch grey">
                Remembered it? <Link href="/login">Back to log in</Link>
              </p>
            </>
          )}
        </div>
        <p className="auth__legal grey">
          Need help? See our <Link href="/privacy">Privacy Policy</Link> and <Link href="/terms">Terms</Link>.
        </p>
      </div>

      <aside className="auth__art" aria-hidden="true">
        <div className="horizon horizon--panel">
          <span className="horizon__haze" />
          <span className="horizon__orb" />
        </div>
        <div className="auth__brand">
          <span className="auth__word">webassure</span>
          <span className="auth__tag">Know your website before you trust it.</span>
        </div>
      </aside>
    </div>
  )
}
