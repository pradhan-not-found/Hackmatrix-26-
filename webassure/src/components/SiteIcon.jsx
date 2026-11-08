'use client'

import { useState } from 'react'

// Favicon of a scanned site. Loaded through Google's favicon service, which
// only receives the hostname: the scanned site itself is never contacted from
// the user's browser (it may be malicious). Falls back to a globe icon.

const Globe = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
  </svg>
)

function hostOf(url) {
  try { return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`).hostname } catch { return '' }
}

export default function SiteIcon({ url, size = 20, className = '' }) {
  const host = hostOf(url || '')
  const [failed, setFailed] = useState(false)
  if (!host || failed) return <span className={`site-icon site-icon--none ${className}`}><Globe /></span>
  return (
    <span className={`site-icon ${className}`}>
      <img
        src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`}
        width={size}
        height={size}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        onLoad={(e) => { if (e.currentTarget.naturalWidth <= 16) setFailed(true) }}
      />
    </span>
  )
}
