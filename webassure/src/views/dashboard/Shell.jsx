'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { api } from '../../lib/investigations.js'
import { getUser, watchAuth, signOut } from '../../lib/auth.js'
import { takePendingScan } from '../../lib/pending.js'
import { useTheme } from '../../components/ThemeProvider.jsx'
import { DashContext } from './context.js'
import Avatar from '../../components/Avatar.jsx'
import ShieldMark from '../../components/ShieldMark.jsx'
import { usePlan } from './usePlan.js'
import { PLANS } from '../../lib/plan.js'
import {
  GridIcon, SearchIcon, ThemeIcon,
} from '../../components/Icons.jsx'
import {
  CertificatesIcon, EmailIcon, LedgerIcon, LogoutIcon, MessagesIcon, OverviewIcon, ReportsIcon, ScansIcon, SettingsIcon, ThreatsIcon,
} from './NavIcons.jsx'

const NAV = [
  ['', 'Overview', OverviewIcon],
  ['scans', 'Scans', ScansIcon],
  ['messages', 'Messages', MessagesIcon],
  ['email-analysis', 'Email analysis', EmailIcon],
  ['threats', 'Threats', ThreatsIcon],
  ['certificates', 'Certificates', CertificatesIcon],
  ['reports', 'Reports', ReportsIcon],
  ['ledger', 'Threat ledger', LedgerIcon],
]

export default function Shell({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const { theme, toggle } = useTheme()
  const [user, setUser] = useState(null)
  const plan = usePlan(user?.id)
  const [scans, setScans] = useState([])
  const [total, setTotal] = useState(0)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [scanLoading, setScanLoading] = useState(false)
  const [failedInput, setFailedInput] = useState('')
  const reportCache = useRef(new Map())
  const historyVersion = useRef(0)
  const accountId = useRef(null)
  const accountVersion = useRef(0)
  const submitting = useRef(false)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [navOpen, setNavOpen] = useState(false)
  const [userMenu, setUserMenu] = useState(false)
  const userMenuRef = useRef(null)
  // Account menu: opens from the avatar, closes on outside click or Escape.
  useEffect(() => {
    if (!userMenu) return
    const onDown = (e) => { if (!userMenuRef.current?.contains(e.target)) setUserMenu(false) }
    const onKey = (e) => { if (e.key === 'Escape') setUserMenu(false) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [userMenu])
  const [collapsed, setCollapsed] = useState(false)

  // Desktop sidebar can collapse to an icon rail; the choice is remembered.
  useEffect(() => {
    try { setCollapsed(localStorage.getItem('wa-sidebar') === 'collapsed') } catch {}
  }, [])
  const toggleCollapsed = () => setCollapsed((c) => {
    try { localStorage.setItem('wa-sidebar', c ? 'open' : 'collapsed') } catch {}
    return !c
  })
  const menuRef = useRef(null)
  const [focusId, setFocusId] = useState(null)
  const [introDone, setIntroDone] = useState(false)

  // Hold the loading screen briefly so the logo fill reads as intentional, not a flash.
  useEffect(() => {
    const t = setTimeout(() => setIntroDone(true), 1300)
    return () => clearTimeout(t)
  }, [])

  // Restore a verified Supabase user; a demo URL cannot bypass sign-in.
  useEffect(() => {
    let active = true
    let stop = () => {}
    const acceptUser = (next) => {
      if (accountId.current !== (next?.id || null)) {
        accountId.current = next?.id || null
        ++accountVersion.current
        ++historyVersion.current
        reportCache.current.clear()
        submitting.current = false
        setScans([]); setTotal(0); setFocusId(null)
        setQuery(''); setFailedInput(''); setError(''); setHistoryError('')
        setHistoryLoading(false); setScanLoading(false)
      }
      setUser(next)
    }
    getUser().then((u) => {
      if (!active) return
      if (!u) { router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`); return }
      acceptUser(u)
      stop = watchAuth((next) => {
        if (!active) return
        acceptUser(next)
        if (!next) router.replace('/login')
      })
    }).catch((failure) => { if (active) setError(failure.message) })
    return () => { active = false; stop() }
  }, [router])

  useEffect(() => setNavOpen(false), [pathname])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 860px)')
    const syncViewport = () => setNavOpen(false)
    syncViewport()
    media.addEventListener('change', syncViewport)
    return () => media.removeEventListener('change', syncViewport)
  }, [])

  useEffect(() => {
    if (!navOpen) return
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setNavOpen(false)
        menuRef.current?.focus()
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [navOpen])

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
    const account = accountVersion.current
    if (reportCache.current.has(id)) return reportCache.current.get(id)
    const report = await api(`/${encodeURIComponent(id)}`)
    if (account !== accountVersion.current) throw new Error('Your account changed. Reopen the report.')
    reportCache.current.set(id, report)
    return report
  }, [])

  const explainReport = useCallback(async (id) => {
    const account = accountVersion.current
    const report = await getReport(id)
    const explanation = await api(`/${encodeURIComponent(id)}/explanation?provider=gemini`, { method: 'POST' })
    if (account !== accountVersion.current) throw new Error('Your account changed. Reopen the report.')
    if (explanation.status === 'completed') reportCache.current.set(id, { ...report, ai_explanation: explanation })
    return explanation
  }, [getReport])

  const runInvestigation = useCallback(async (input, options = {}) => {
    if (!input.trim() || submitting.current) return
    submitting.current = true
    const account = accountVersion.current
    setScanLoading(true)
    setError('')
    setFailedInput('')
    try {
      const report = await api('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: input.trim() }) })
      if (account !== accountVersion.current) return
      reportCache.current.set(report.id, report)
      ++historyVersion.current
      setScans((previous) => [report, ...previous.filter((item) => item.id !== report.id)])
      setTotal((previous) => previous + 1)
      if (options.navigate !== false) setFocusId(report.id)
      setQuery('')
      if (options.navigate !== false) router.push('/dashboard/scans')
      await loadHistory()
      return report
    } catch (failure) {
      if (account === accountVersion.current) { setError(failure.message); setFailedInput(input) }
    } finally {
      if (account === accountVersion.current) { submitting.current = false; setScanLoading(false) }
    }
  }, [loadHistory, router])

  useEffect(() => {
    if (!user) return
    loadHistory()
    const pending = takePendingScan()
    if (pending) { setQuery(pending); runInvestigation(pending) }
  }, [user, loadHistory, runInvestigation])

  const clearFocus = useCallback(() => setFocusId(null), [])
  const addScan = useCallback((scan) => {
    setScans((previous) => [scan, ...previous.filter((item) => item.id !== scan.id)])
    setTotal((previous) => previous + 1)
  }, [])
  if (!user || !introDone) {
    return (
      <div className="dash-loading" role="status" aria-label="Loading your workspace">
        <span className="dl__mark">webassure</span>
        <span className="dl__note">Preparing your workspace</span>
        {error && <><p role="alert">{error}</p><Link href="/login">Return to sign in</Link></>}
      </div>
    )
  }

  const seg = pathname.split('/')[2] || ''
  const known = NAV.find(([p]) => p === seg)
  const missing = !known && seg !== 'settings' && seg !== 'upgrade'
  const current = seg === 'settings' || seg === 'upgrade' ? 'Settings' : missing ? '' : known[1]
  const crumbNow = seg === 'upgrade' ? 'Plans' : missing ? 'Page not found' : current
  const href = (p) => `/dashboard${p ? `/${p}` : ''}`

  const runScan = (event) => { event.preventDefault(); runInvestigation(query) }

  const logout = async () => {
    try { await signOut(); router.replace('/login') }
    catch (failure) { setError(failure.message) }
  }

  const ctx = { scans, total, historyLoading, historyError, refreshHistory: loadHistory,
    loadMore: () => loadHistory(scans.length), getReport, explainReport, scanLoading, runInvestigation,
    user, setUser, focusId, clearFocus, addScan }

  return (
    <DashContext.Provider value={ctx}>
      <div className="dash" data-nav={navOpen || undefined} data-rail={collapsed || undefined}>
        <aside className="dash__side" id="dashboard-sidebar">
          <div className="rail__head">
            <Link href="/" className="wordmark dash__logo" aria-label="WebAssure home">
              <span className="rail__full">webassure</span>
              <span className="rail__mini" aria-hidden="true"><ShieldMark size={28} /></span>
            </Link>
            <button className="rail__toggle" onClick={toggleCollapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" /><path className="rail__chev" d="m15.5 10-2 2 2 2" />
              </svg>
            </button>
          </div>
          <nav className="dash__nav" aria-label="Dashboard">
            {NAV.map(([p, label, Icon]) => (
              <Link key={label} href={href(p)} className={`dash__link${current === label ? ' active' : ''}`} aria-current={current === label ? 'page' : undefined} data-tip={label}>
                <Icon />
                <span className="rail__label">{label}</span>
              </Link>
            ))}
          </nav>
          <div className="dash__side-foot">
            <Link href="/dashboard/settings" className={`dash__link${current === 'Settings' ? ' active' : ''}`} data-tip="Settings">
              <SettingsIcon /><span className="rail__label">Settings</span>
            </Link>
            <div className="dash__user" ref={userMenuRef}>
              <button className="dash__user-btn" onClick={() => setUserMenu((o) => !o)} aria-haspopup="menu" aria-expanded={userMenu} aria-label="Account menu">
                <Avatar src={user.avatar} size={34} className="dash__av" />
                <span className="dash__user-txt">
                  <span className="dash__user-name" title={user.name}>{user.name}</span>
                </span>
              </button>
              <button className="icon-btn dash__user-out" onClick={logout} aria-label="Log out"><LogoutIcon /></button>
              {userMenu && (
                <div className="umenu" role="menu">
                  <div className="umenu__head">
                    <Avatar src={user.avatar} size={36} />
                    <div className="umenu__who">
                      <p className="umenu__name">{user.name}</p>
                      {user.email && <p className="umenu__mail">{user.email}</p>}
                    </div>
                  </div>
                  <Link href="/dashboard/settings" className="umenu__item" role="menuitem" onClick={() => setUserMenu(false)}>
                    <SettingsIcon /><span>Settings</span>
                  </Link>
                  <button className="umenu__item umenu__item--out" role="menuitem" onClick={() => { setUserMenu(false); logout() }}>
                    <LogoutIcon /><span>Log out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>

        <div className="dash__main" key={user.id}>
          <header className="dash__top">
            <button ref={menuRef} className="icon-btn dash__menu" onClick={() => setNavOpen((o) => !o)} aria-label="Toggle navigation">
              <GridIcon />
            </button>
            <p className="dash__crumb crumb">
              {(() => {
                if (missing) return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 8v4.5M12 16h.01" /></svg>
                const Icon = current === 'Settings' ? SettingsIcon : (NAV.find(([, l]) => l === current) || NAV[0])[2]
                return <Icon />
              })()}
              <span className="crumb__root">{seg === 'upgrade' ? 'Settings' : 'Workspace'}</span>
              <span className="crumb__sep" aria-hidden="true">/</span>
              <span className="crumb__now">{crumbNow}</span>
            </p>
            <form className="dash__scan" onSubmit={runScan} role="search" aria-busy={scanLoading}>
              <SearchIcon />
              <label htmlFor="dash-scan" className="skip">URL to scan</label>
              <input id="dash-scan" placeholder="Scan a URL or domain…" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
              <button className="btn btn--ink" type="submit" disabled={scanLoading}>{scanLoading ? 'Scanning…' : 'Scan'}</button>
            </form>
            {plan.id !== 'teams' && (
              <Link href="/dashboard/upgrade" className="upbtn" title={`You are on ${PLANS[plan.id].name}. See plans`}>
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 16V8.5" /><path d="M8.5 11.5 12 8l3.5 3.5" /></svg>
                Upgrade
              </Link>
            )}
            <button className="icon-btn" onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
              <ThemeIcon />
            </button>
          </header>
          <div className="dash__content" id="dash-content">
            {scanLoading && <p className="scan-status caption" role="status">Investigating URL. Collecting network checks and threat intelligence…</p>}
            {error && <div className="dash__err" role="alert">{error} <button className="btn btn--ghost" disabled={scanLoading} onClick={() => runInvestigation(failedInput)}>Retry scan</button></div>}
            {children}
          </div>
        </div>
        <button className="dash__scrim" onClick={() => setNavOpen(false)} aria-label="Close navigation" tabIndex={navOpen ? 0 : -1} />
      </div>
    </DashContext.Provider>
  )
}
