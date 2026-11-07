'use client'

import { useEffect, useState } from 'react'

const PHRASES = ['Know your website', 'Trust every link', 'Click with confidence']

const HOLD = 1900 // ms the phrases stay on screen
const EXIT = 700 // ms fade-out

export default function Preloader({ onDone }) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onDone()
      return
    }
    document.documentElement.style.overflow = 'hidden'
    const a = setTimeout(() => setLeaving(true), HOLD)
    const b = setTimeout(() => {
      document.documentElement.style.overflow = ''
      onDone()
    }, HOLD + EXIT)
    return () => {
      clearTimeout(a)
      clearTimeout(b)
      document.documentElement.style.overflow = ''
    }
  }, [onDone])

  return (
    <div className="preloader" data-leaving={leaving || undefined} aria-hidden="true">
      {PHRASES.map((p, i) => (
        <span key={p} className="preloader__phrase" style={{ animationDelay: `${0.15 + i * 0.18}s` }}>
          {p}
        </span>
      ))}
    </div>
  )
}
