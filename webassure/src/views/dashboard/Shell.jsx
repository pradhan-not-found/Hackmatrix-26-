'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { api } from '../../lib/investigations.js'
import { getUser, signIn, signOut } from '../../lib/auth.js'
import { takePendingScan } from '../../lib/pending.js'
import { useTheme } from '../../components/ThemeProvider.jsx'
import { DashContext } from './context.js'
import {
  PersonPlaceholder, FileIcon, GridIcon, LedgerIcon, LockIcon, LogoutIcon, ScanIcon, SearchIcon, SettingsIcon, ShieldIcon, ThemeIcon,
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
  const [scans, setScans] = useState([])
  const [total, setTotal] = useState(0)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [scanLoading, setScanLoading] = useState(false)
  const [failedInput, setFailedInput] = useState('')
  const reportCache = useRef(new Map())
  const historyVersion = useRef(0)
  const submitting = useRef(false)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [navOpen, setNavOpen] = useState(false)
  const [focusId, setFocusId] = useState(null)
  const [introDone, setIntroDone] = useState(false)

  // Hold the loading screen briefly so the logo fill reads as intentional, not a flash.
  useEffect(() => {
    const t = setTimeout(() => setIntroDone(true), 1300)
    return () => clearTimeout(t)
  }, [])

  // Client-side guard (demo auth lives in localStorage). ?demo opens a demo session.
  useEffect(() => {
    let u = getUser()
    if (!u && new URLSearchParams(window.location.search).has('demo')) u = signIn('demo@webassure.dev', 'Demo user')
    if (!u) router.replace('/login')
    else setUser(u)
  }, [router])

  useEffect(() => setNavOpen(false), [pathname])

  const loadHistory = useCallback(async (offset = 0) => {
    const version = ++historyVersion.current
    setHistoryLoading(true)
    setHistoryError('')
    try {
      const page = await api(`?limit=30&offset=${offset}`)
      if (version !== historyVersion.current) return
      setScans((previous) => offset ? [...new Map([...previous, ...page.items].map((item) => [item.id, item])).values()] : page.items)
      setTotal(page.total)
    } catch (failure) {
      if (version === historyVersion.current) setHistoryError(failure.message)
    } finally {
      if (version === historyVersion.current) setHistoryLoading(false)
    }
  }, [])

  const getReport = useCallback(async (id) => {
    if (reportCache.current.has(id)) return reportCache.current.get(id)
    const report = await api(`/${encodeURIComponent(id)}`)
    reportCache.current.set(id, report)
    return report
  }, [])

  const runInvestigation = useCallback(async (input) => {
    if (!input.trim() || submitting.current) return
    submitting.current = true
    setScanLoading(true)
    setError('')
    setFailedInput('')
    try {
      const report = await api('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: input.trim() }) })
      reportCache.current.set(report.id, report)
      ++historyVersion.current
      setScans((previous) => [report, ...previous.filter((item) => item.id !== report.id)])
      setTotal((previous) => previous + 1)
      setFocusId(report.id)
      setQuery('')
      router.push('/dashboard/scans')
      await loadHistory()
    } catch (failure) {
      setError(failure.message)
      setFailedInput(input)
    } finally {
      submitting.current = false
      setScanLoading(false)
    }
  }, [loadHistory, router])

  useEffect(() => {
    if (!user) return
    loadHistory()
    const pending = takePendingScan()
    if (pending) { setQuery(pending); runInvestigation(pending) }
  }, [user, loadHistory, runInvestigation])

  const clearFocus = useCallback(() => setFocusId(null), [])
  if (!user || !introDone) {
    return (
      <div className="dash-loading" role="status" aria-label="Loading your workspace">
        <span className="dl__mark">webassure</span>
        <span className="dl__note">Preparing your workspace</span>
      </div>
    )
  }

  const seg = pathname.split('/')[2] || ''
  const current = seg === 'settings' ? 'Settings' : (NAV.find(([p]) => p === seg) || NAV[0])[1]
  const href = (p) => `/dashboard${p ? `/${p}` : ''}`

  const runScan = (event) => { event.preventDefault(); runInvestigation(query) }

  const logout = () => {
    signOut()
    router.push('/')
  }

  const ctx = { scans, total, historyLoading, historyError, refreshHistory: loadHistory,
    loadMore: () => loadHistory(scans.length), getReport, scanLoading,
    user, setUser, focusId, clearFocus }

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
              <span className="dash__avatar">
                {user.avatar ? <img src={user.avatar} alt="" /> : <PersonPlaceholder />}
              </span>
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
            <form className="dash__scan" onSubmit={runScan} role="search" aria-busy={scanLoading}>
              <SearchIcon />
              <label htmlFor="dash-scan" className="skip">URL to scan</label>
              <input id="dash-scan" placeholder="Scan a URL or domain…" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
              <button className="btn btn--ink" type="submit" disabled={scanLoading}>{scanLoading ? 'Scanning…' : 'Scan'}</button>
            </form>
            <button className="icon-btn" onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
              <ThemeIcon />
            </button>
          </header>
          {scanLoading && <p className="scan-status caption" role="status">Investigating URL. Collecting network checks and threat intelligence…</p>}
          {error && <div className="dash__err" role="alert">{error} <button className="btn btn--ghost" disabled={scanLoading} onClick={() => runInvestigation(failedInput)}>Retry scan</button></div>}
          {children}
        </div>
        <button className="dash__scrim" onClick={() => setNavOpen(false)} aria-label="Close navigation" tabIndex={navOpen ? 0 : -1} />
      </div>
    </DashContext.Provider>
  )
}
