'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { analyze } from '../../lib/analyze.js'
import { getUser, signIn, signOut } from '../../lib/auth.js'
import { SEED_SCANS } from '../../lib/data.js'
import { takePendingScan } from '../../lib/pending.js'
import { useTheme } from '../../components/ThemeProvider.jsx'
import { DashContext } from './context.js'
import {
  FileIcon, GridIcon, LedgerIcon, LockIcon, LogoutIcon, ScanIcon, SearchIcon, SettingsIcon, ShieldIcon, ThemeIcon,
} from '../../components/Icons.jsx'

const NAV = [
  ['', 'Overview', GridIcon],
  ['scans', 'Scans', ScanIcon],
  ['threats', 'Threats', ShieldIcon],
  ['certificates', 'Certificates', LockIcon],
  ['reports', 'Reports', FileIcon],
  ['ledger', 'Threat ledger', LedgerIcon],
]

export default function Shell({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const { theme, toggle } = useTheme()
  const [user, setUser] = useState(null)
  const [scans, setScans] = useState(SEED_SCANS)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [navOpen, setNavOpen] = useState(false)
  const [focusId, setFocusId] = useState(null)

  // Client-side guard (demo auth lives in localStorage). ?demo opens a demo session.
  useEffect(() => {
    let u = getUser()
    if (!u && new URLSearchParams(window.location.search).has('demo')) u = signIn('demo@webassure.dev', 'Demo user')
    if (!u) router.replace('/login')
    else setUser(u)
  }, [router])

  useEffect(() => setNavOpen(false), [pathname])

  useEffect(() => {
    if (!user) return
    const pending = takePendingScan()
    if (!pending) return
    const r = analyze(pending)
    if (!r) return
    const id = `s-${1100 + Math.floor(Math.random() * 800)}`
    setScans((s) => [{
      id, url: pending.trim().replace(/^https?:\/\//, ''), risk: r.risk,
      category: r.findings[0]?.weight ? 'Heuristic flags' : 'No flags', when: 'Just now', source: 'Website',
      findings: r.findings.map((f) => f.text), fresh: true,
    }, ...s])
    setFocusId(id)
  }, [user])

  if (!user) return <div className="dash-loading" aria-busy="true" />

  const seg = pathname.split('/')[2] || ''
  const current = seg === 'settings' ? 'Settings' : (NAV.find(([p]) => p === seg) || NAV[0])[1]
  const href = (p) => `/dashboard${p ? `/${p}` : ''}`

  const addScan = (input) => {
    const r = analyze(input)
    if (!r) return null
    const scan = {
      id: `s-${1043 + scans.length}`,
      url: input.trim().replace(/^https?:\/\//, ''),
      risk: r.risk,
      category: r.findings[0]?.weight ? 'Heuristic flags' : 'No flags',
      when: 'Just now',
      source: 'Manual',
      findings: r.findings.map((f) => f.text),
      fresh: true,
    }
    setScans((s) => [scan, ...s])
    return scan
  }

  const runScan = (e) => {
    e.preventDefault()
    if (!query.trim()) return
    if (!addScan(query)) return setError('Enter a valid URL or domain.')
    setError('')
    setQuery('')
    if (seg !== '' && seg !== 'scans') router.push('/dashboard/scans')
  }

  const logout = () => {
    signOut()
    router.push('/')
  }

  const ctx = { scans, addScan, user, setUser, focusId, clearFocus: () => setFocusId(null) }

  return (
    <DashContext.Provider value={ctx}>
      <div className="dash" data-nav={navOpen || undefined}>
        <aside className="dash__side">
          <Link href="/" className="wordmark dash__logo">webassure</Link>
          <nav className="dash__nav" aria-label="Dashboard">
            {NAV.map(([p, label, Icon]) => (
              <Link key={label} href={href(p)} className={`dash__link${current === label ? ' active' : ''}`} aria-current={current === label ? 'page' : undefined}>
                <Icon />
                {label}
              </Link>
            ))}
          </nav>
          <div className="dash__side-foot">
            <Link href="/dashboard/settings" className={`dash__link${current === 'Settings' ? ' active' : ''}`}>
              <SettingsIcon />Settings
            </Link>
            <div className="dash__user">
              <span className="dash__avatar">{user.name.slice(0, 1).toUpperCase()}</span>
              <div className="dash__user-txt">
                <p>{user.name}</p>
                <p className="caption grey">{user.email}</p>
              </div>
              <button className="icon-btn" onClick={logout} aria-label="Log out"><LogoutIcon /></button>
            </div>
          </div>
        </aside>

        <div className="dash__main">
          <header className="dash__top">
            <button className="icon-btn dash__menu" onClick={() => setNavOpen((o) => !o)} aria-label="Toggle navigation">
              <GridIcon />
            </button>
            <p className="dash__crumb"><span className="grey">Workspace</span> / {current}</p>
            <form className="dash__scan" onSubmit={runScan} role="search">
              <SearchIcon />
              <label htmlFor="dash-scan" className="skip">URL to scan</label>
              <input id="dash-scan" placeholder="Scan a URL or domain…" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
              <button className="btn btn--ink" type="submit">Scan</button>
            </form>
            <button className="icon-btn" onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
              <ThemeIcon />
            </button>
          </header>
          {error && <p className="dash__err" role="alert">{error}</p>}
          {children}
        </div>
        <button className="dash__scrim" onClick={() => setNavOpen(false)} aria-label="Close navigation" tabIndex={navOpen ? 0 : -1} />
      </div>
    </DashContext.Provider>
  )
}
