'use client'

import { useEffect, useState } from 'react'

const PHRASES = ['Know your website', 'Trust every link', 'Click with confidence']

const HOLD = 2300 // ms: phrases write in letter by letter, then hold
const EXIT = 1250 // ms: phrases leave, then the panel lifts away

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
        <span key={p} className="preloader__phrase" aria-label={p}>
          {[...p].map((ch, j) => (
            <span key={j} className="preloader__ch" style={{ animationDelay: `${0.15 + i * 0.22 + j * 0.032}s` }}>
              {ch === ' ' ? ' ' : ch}
            </span>
          ))}
        </span>
      ))}
    </div>
  )
}
