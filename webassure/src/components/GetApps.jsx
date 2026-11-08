'use client'

import { useEffect, useState } from 'react'

// "Coming soon" app buttons for the footer. The platform / browser name
// rotates so one button can announce every target.

const ICONS = {
  mac: <path d="M16.4 12.7c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.2-1.2 3-2.4.9-1.3 1.3-2.7 1.3-2.8 0 0-2.5-1-2.5-3.9zM14 5.5c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.6 2.8-1.4z" fill="currentColor" />,
  android: <><path d="M6.5 9.5h11v7.5a1.5 1.5 0 0 1-1.5 1.5H8a1.5 1.5 0 0 1-1.5-1.5z" fill="currentColor" /><path d="M6.6 8.5a5.4 5.4 0 0 1 10.8 0z" fill="currentColor" /><path d="M8 3.8l1.2 2M16 3.8l-1.2 2M4.2 10v5M19.8 10v5M9.5 18.5V21M14.5 18.5V21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" /></>,
  windows: <><rect x="3.5" y="3.5" width="17" height="17" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M12 3.5v17M3.5 12h17" stroke="currentColor" strokeWidth="1.8" /></>,
  puzzle: <path d="M10 3.5a2 2 0 0 1 4 0V5h3.5a1.5 1.5 0 0 1 1.5 1.5V10h-1.5a2 2 0 0 0 0 4H19v3.5a1.5 1.5 0 0 1-1.5 1.5H14v-1.5a2 2 0 0 0-4 0V19H6.5A1.5 1.5 0 0 1 5 17.5V14h1.5a2 2 0 0 0 0-4H5V6.5A1.5 1.5 0 0 1 6.5 5H10z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />,
}

const PLATFORMS = [['Mac', 'mac'], ['Android', 'android'], ['Windows', 'windows']]
const BROWSERS = ['Chrome', 'Edge', 'Firefox', 'Brave']

function useCycle(length, ms) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setI((n) => (n + 1) % length), ms)
    return () => clearInterval(t)
  }, [length, ms])
  return i
}

const Icon = ({ name }) => <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">{ICONS[name]}</svg>

export default function GetApps() {
  const p = useCycle(PLATFORMS.length, 2400)
  const b = useCycle(BROWSERS.length, 2400)
  const [label, icon] = PLATFORMS[p]
  return (
    <div className="getapps" aria-label="WebAssure apps, coming soon">
      <button type="button" className="getapp getapp--solid" disabled title="Coming soon">
        <span className="getapp__ic" key={icon}><Icon name={icon} /></span>
        <span className="getapp__txt">Download for <span className="getapp__swap" key={label}>{label}</span></span>
        <span className="getapp__soon">Soon</span>
      </button>
      <button type="button" className="getapp getapp--line" disabled title="Coming soon">
        <span className="getapp__ic"><Icon name="puzzle" /></span>
        <span className="getapp__txt">Add to <span className="getapp__swap" key={BROWSERS[b]}>{BROWSERS[b]}</span></span>
        <span className="getapp__soon">Soon</span>
      </button>
    </div>
  )
}
