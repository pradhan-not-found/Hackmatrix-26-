'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Thermal from '../components/Thermal.jsx'
import { signIn } from '../lib/auth.js'

export default function Login({ mode }) {
  const isSignup = mode === 'signup'
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = (e) => {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    setError('')
    setBusy(true)
    setTimeout(() => {
      signIn(email, name)
      router.push(nextPath())
    }, 600)
  }

  const nextPath = () => {
    const n = new URLSearchParams(window.location.search).get('next')
    return n && n.startsWith('/dashboard') ? n : '/dashboard'
  }

  const sso = (provider) => {
    signIn(`demo@${provider.toLowerCase()}.com`, 'Demo user')
    router.push(nextPath())
  }

  return (
    <div className="auth">
      <div className="auth__form-side">
        <Link href="/" className="wordmark auth__logo" aria-label="WebAssure home">webassure</Link>

        <div className="auth__box">
          <h1 className="auth__title">{isSignup ? 'Create your account' : 'Welcome back'}</h1>
          <p className="auth__sub grey">
            {isSignup ? 'Start checking links, sites and certificates in seconds.' : 'Log in to your WebAssure dashboard.'}
          </p>

          <div className="auth__sso">
            <button type="button" className="btn btn--ghost btn--block" onClick={() => sso('Google')}>
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" />
                <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.8c-1 .7-2.2 1.1-3.7 1.1-2.8 0-5.2-1.9-6.1-4.5H2.2v2.8A11 11 0 0 0 12 23z" />
                <path fill="#FBBC05" d="M5.9 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.2a11 11 0 0 0 0 9.8z" />
                <path fill="#EA4335" d="M12 5.4c1.6 0 3 .5 4.1 1.6l3.1-3.1A11 11 0 0 0 2.2 7.1l3.7 2.8C6.8 7.3 9.2 5.4 12 5.4z" />
              </svg>
              Continue with Google
            </button>
            <button type="button" className="btn btn--ghost btn--block" onClick={() => sso('GitHub')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5z" />
              </svg>
              Continue with GitHub
            </button>
          </div>

          <div className="auth__or"><span>or</span></div>

          <form onSubmit={submit} noValidate className="auth__fields">
            {isSignup && (
              <label className="field">
                <span>Full name</span>
                <input type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Asha Rao" />
              </label>
            )}
            <label className="field">
              <span>Work email</span>
              <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </label>
            <label className="field">
              <span className="field__row">
                Password
                {!isSignup && <a href="#" className="field__link">Forgot?</a>}
              </span>
              <input
                type="password"
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </label>
            {error && <p className="auth__error" role="alert">{error}</p>}
            <button className="btn btn--ink btn--block" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Log in'}
            </button>
          </form>

          <p className="auth__switch grey">
            {isSignup ? 'Already have an account? ' : 'New to WebAssure? '}
            <Link href={isSignup ? '/login' : '/signup'} onClick={(e) => {
              const q = window.location.search
              if (q) { e.preventDefault(); router.push((isSignup ? '/login' : '/signup') + q) }
            }}>{isSignup ? 'Log in' : 'Create an account'}</Link>
          </p>
        </div>

        <p className="auth__legal grey">
          By continuing you agree to the <a href="#">Terms</a> and <a href="#">Privacy Policy</a>.
        </p>
      </div>

      <aside className="auth__art" aria-hidden="true">
        <div className="auth__mark">
          <Thermal text="webassure" />
        </div>
        <div className="auth__phrases">
          <span>Know your website</span>
          <span>Trust every link</span>
          <span>Click with confidence</span>
        </div>
      </aside>
    </div>
  )
}
