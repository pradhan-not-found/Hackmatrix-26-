'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getUser } from '../lib/auth.js'
import { ThemeIcon } from './Icons.jsx'
import VoiceOrb from './VoiceOrb.jsx'
import { useTheme } from './ThemeProvider.jsx'

const LINKS = [
  ['Product', '#product'],
  ['How it works', '#how'],
  ['Pricing', '#pricing'],
  ['FAQ', '#faq'],
]

export default function Header() {
  const { toggle } = useTheme()
  const [scrolled, setScrolled] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    setUser(getUser())
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className="hdr" data-scrolled={scrolled || undefined}>
      <div className="hdr__in">
        <Link href="/" className="wordmark" aria-label="WebAssure home">webassure</Link>
        <nav className="hdr__nav" aria-label="Main">
          {LINKS.map(([label, href]) => (
            <a key={label} href={href}>{label}</a>
          ))}
        </nav>
        <div className="hdr__actions">
          <button className="icon-btn" onClick={toggle} aria-label="Toggle theme">
            <ThemeIcon />
          </button>
          {user ? (
            <Link href="/dashboard" className="btn btn--ink">Dashboard</Link>
          ) : (
            <>
              <Link href="/login" className="btn btn--ghost hdr__login">Log in</Link>
              <Link href="/signup" className="btn btn--ink">Get started</Link>
            </>
          )}
        </div>
      </div>
      <VoiceOrb />
    </header>
  )
}
