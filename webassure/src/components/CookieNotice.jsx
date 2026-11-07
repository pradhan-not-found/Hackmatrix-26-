'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const KEY = 'wa-cookies'

export default function CookieNotice() {
  const [show, setShow] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    let saved = null
    try {
      saved = localStorage.getItem(KEY)
    } catch {}
    if (saved) return
    const t = setTimeout(() => setShow(true), 1400)
    return () => clearTimeout(t)
  }, [])

  const choose = (value) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ choice: value, at: new Date().toISOString() }))
    } catch {}
    setLeaving(true)
    setTimeout(() => setShow(false), 350)
  }

  if (!show) return null

  return (
    <div className="cookie" data-leaving={leaving || undefined} role="dialog" aria-live="polite" aria-label="Cookie preferences">
      <p className="cookie__t">We use cookies</p>
      <p className="cookie__d">
        Essential cookies keep you signed in. Optional analytics help us improve WebAssure.{' '}
        <Link href="/#faq">Privacy</Link>
      </p>
      <div className="cookie__btns">
        <button className="btn btn--soft" onClick={() => choose('essential')}>Essential only</button>
        <button className="btn btn--ink" onClick={() => choose('all')}>Accept all</button>
      </div>
    </div>
  )
}
