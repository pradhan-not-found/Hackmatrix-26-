'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getUser } from '../lib/auth.js'
import { setPendingScan } from '../lib/pending.js'
import Thermal from './Thermal.jsx'

export default function Hero() {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  // Checking a link hands it to the dashboard: logged-in users go straight there,
  // everyone else logs in first and the scan runs right after.
  const submit = async (e) => {
    e.preventDefault()
    if (!value.trim()) return
    setError('')
    setPendingScan(value)
    try { router.push(await getUser() ? '/dashboard/scans' : '/login?next=/dashboard/scans') }
    catch { router.push('/login?next=/dashboard/scans') }
  }

  return (
    <section className="hero" id="top">
      <h1 className="skip">WebAssure</h1>
      <div className="hero__logo">
        <Thermal text="webassure" />
      </div>
      <div className="hero__band wrap">
        <p className="t-lead hero__lead">
          An AI security platform that spots phishing sites, fake portals and forged certificates, and
          explains why in plain language.
        </p>
        <div className="hero__scan">
          <form className="scan" onSubmit={submit} role="search">
            <label htmlFor="scan-input" className="skip">URL to check</label>
            <input
              id="scan-input"
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck="false"
              placeholder="Paste a suspicious link…"
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                if (error) setError('')
              }}
            />
            <button className="btn btn--ink" type="submit">Check link</button>
          </form>
          {error ? (
            <p className="t-caption scan-error" role="alert">{error}</p>
          ) : (
            <p className="t-caption grey scan-hint">Free account required · results in seconds</p>
          )}
        </div>
      </div>
    </section>
  )
}
