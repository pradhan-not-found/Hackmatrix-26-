'use client'

import { useEffect, useState } from 'react'

const PHRASES = ['Know your website', 'Trust every link', 'Click with confidence']

const CH = 0.03 // s between letters
const GAP = 0.18 // s pause between phrases
// Each phrase starts after the previous one has finished writing.
const STARTS = PHRASES.reduce((acc, p, i) => [...acc, i ? acc[i - 1] + PHRASES[i - 1].length * CH + GAP : 0.2], [])
const WRITTEN = (STARTS[STARTS.length - 1] + PHRASES[PHRASES.length - 1].length * CH + 0.5) * 1000
const HOLD = Math.round(WRITTEN + 450) // ms: all three written, then a short hold
const EXIT = 1300 // ms: a soft blob opens from the centre and dissolves the screen

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
            <span key={j} className="preloader__ch" style={{ animationDelay: `${STARTS[i] + j * CH}s` }}>
              {ch === ' ' ? ' ' : ch}
            </span>
          ))}
        </span>
      ))}
    </div>
  )
}
