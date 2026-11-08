'use client'

import { useEffect, useState } from 'react'
import { BRAND } from './brandIcons.js'

// Coming-soon app and browser-extension buttons for the footer. Each button's
// logo and name roll up to the next option, one after another, like a ticker.

const APPS = [['Mac', 'apple'], ['Android', 'android']]
const BROWSERS = [['Chrome', 'chrome'], ['Firefox', 'firefox'], ['Brave', 'brave']]

function useTicker(ms, offset = 0) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let t
    const start = setTimeout(() => { t = setInterval(() => setI((n) => n + 1), ms) }, offset)
    return () => { clearTimeout(start); clearInterval(t) }
  }, [ms, offset])
  return i
}

function Logo({ name, mono }) {
  const b = BRAND[name]
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d={b.path} fill={mono ? 'currentColor' : b.color} />
    </svg>
  )
}

// A vertical ticker that always rolls forward: the first option is repeated
// at the end, and once the roll reaches that copy it snaps back invisibly.
function Ticker({ items, n, prefix, mono }) {
  const len = items.length
  const k = n % len
  const atCopy = n > 0 && k === 0
  const [snapped, setSnapped] = useState(false)
  useEffect(() => { setSnapped(false) }, [n])
  const idx = atCopy && !snapped ? len : k
  return (
    <span className="tick" aria-live="off">
      <span
        className="tick__rail"
        style={{ transform: `translateY(${-idx * 28}px)`, transition: atCopy && snapped ? 'none' : undefined }}
        onTransitionEnd={() => { if (atCopy) setSnapped(true) }}
      >
        {[...items, items[0]].map(([label, logo], i) => (
          <span key={label + i} className="tick__item" aria-hidden={i === len || undefined}>
            <Logo name={logo} mono={mono && logo === 'apple'} />
            <span>{prefix} <b>{label}</b></span>
          </span>
        ))}
      </span>
    </span>
  )
}

export default function GetApps() {
  const a = useTicker(2800)
  const b = useTicker(2800, 1400)
  return (
    <div className="getapps">
      <p className="getapps__k">Coming soon</p>
      <div className="getapps__row">
        <button type="button" className="getapp getapp--dark" disabled aria-label="Desktop and mobile apps, coming soon">
          <Ticker items={APPS} n={a} prefix="Download for" mono />
        </button>
        <button type="button" className="getapp getapp--light" disabled aria-label="Browser extension, coming soon">
          <Ticker items={BROWSERS} n={b} prefix="Add to" />
        </button>
      </div>
    </div>
  )
}
