'use client'

import { useState } from 'react'

// One avatar everywhere: the user's photo, or a glossy blue badge with a line icon.
export default function Avatar({ src, size = 36, className = '' }) {
  const [failedSrc, setFailedSrc] = useState(null)
  return (
    <span className={`av ${className}`} style={{ width: size, height: size }}>
      {src && failedSrc !== src ? (
        <img key={src} src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailedSrc(src)} />
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="9" r="3.6" />
          <path d="M5.5 19.2c1.2-3.1 3.6-4.7 6.5-4.7s5.3 1.6 6.5 4.7" />
        </svg>
      )}
    </span>
  )
}
