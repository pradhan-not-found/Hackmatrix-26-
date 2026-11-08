'use client'

import { useEffect, useState } from 'react'
import { BRAND } from './brandIcons.js'

// Coming-soon app and browser-extension buttons for the footer. Each button's
// logo and name roll up to the next option, one after another, like a ticker.

const APPS = [['Mac', 'apple'], ['Android', 'android']]
const BROWSERS = [['Chrome', 'chrome'], ['Firefox', 'firefox'], ['Brave', 'brave']]

function useTicker(length, ms, offset = 0) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let t
    const start = setTimeout(() => { t = setInterval(() => setI((n) => n + 1), ms) }, offset)
    return () => { clearTimeout(start); clearInterval(t) }
  }, [ms, offset])
  return i % length
}

function Logo({ name, mono }) {
  const b = BRAND[name]
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d={b.path} fill={mono ? 'currentColor' : b.color} />
    </svg>
  )
}

// A vertical ticker: every option is stacked; the stack slides to the active one.
function Ticker({ items, index, prefix, mono }) {
  return (
    <span className="tick" aria-live="off">
      <span className="tick__rail" style={{ transform: `translateY(${-index * 100}%)` }}>
        {items.map(([label, logo]) => (
          <span key={label} className="tick__item">
            <Logo name={logo} mono={mono && logo === 'apple'} />
            <span>{prefix} <b>{label}</b></span>
          </span>
        ))}
      </span>
    </span>
  )
}

export default function GetApps() {
  const a = useTicker(APPS.length, 2600)
  const b = useTicker(BROWSERS.length, 2600, 1300)
  return (
    <div className="getapps">
      <p className="getapps__k">Coming soon</p>
      <div className="getapps__row">
        <button type="button" className="getapp getapp--dark" disabled aria-label="Desktop and mobile apps, coming soon">
          <Ticker items={APPS} index={a} prefix="Download for" mono />
        </button>
        <button type="button" className="getapp getapp--light" disabled aria-label="Browser extension, coming soon">
          <Ticker items={BROWSERS} index={b} prefix="Add to" />
        </button>
      </div>
    </div>
  )
}
