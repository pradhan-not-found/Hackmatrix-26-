'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDash } from './context.js'
import { removeAvatar, resetPassword, signOut, updateUser, uploadAvatar } from '../../lib/auth.js'
import Avatar from '../../components/Avatar.jsx'
import Link from 'next/link'
import { PageHead, Toggle } from './ui.jsx'
import ConnectedAccounts from './ConnectedAccounts.jsx'
import { usePlan } from './usePlan.js'
import { PLANS, chargeFor, inr, priceFor } from '../../lib/plan.js'

const Ic = ({ d }) => (
  <svg className="nav-ic" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
)
const PAGES = [
  ['profile', 'Profile', <Ic key="p" d={<><circle cx="12" cy="8.5" r="3.5" /><path d="M5 19.5c1.3-3.3 3.9-5 7-5s5.7 1.7 7 5" /></>} />],
  ['notifications', 'Notifications', <Ic key="n" d={<><path d="M6.5 10a5.5 5.5 0 0 1 11 0v3.5l1.5 2.5H5l1.5-2.5Z" /><path d="M10 19a2 2 0 0 0 4 0" /></>} />],
  ['password', 'Password', <Ic key="k" d={<><rect x="4.5" y="10.5" width="15" height="9.5" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /><path d="M12 14.5v2" /></>} />],
  ['accounts', 'Connected accounts', <Ic key="c" d={<><path d="M9.5 14.5 14.5 9.5" /><path d="M11 6.5l1.5-1.5a4.2 4.2 0 0 1 6 6L17 12.5" /><path d="M13 17.5 11.5 19a4.2 4.2 0 0 1-6-6L7 11.5" /></>} />],
  ['plan', 'Plan & billing', <Ic key="b" d={<><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><path d="M3.5 10h17" /><path d="M7.5 15h3" /></>} />],
  ['session', 'Session', <Ic key="s" d={<><path d="M14.5 4h3A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-3" /><path d="M10 16.5 14.5 12 10 7.5" /><path d="M14.5 12H4" /></>} />],
]

const ALERTS = [
  ['high', 'High-risk scan detected', 'When an investigation is classified High Risk or Confirmed Malicious.'],
  ['certs', 'Certificate alerts', 'Expiry within 14 days, weak keys or missing CT entries.'],
  ['weekly', 'Weekly summary', 'A digest of scans and threats every Monday.'],
]

export default function Settings() {
  const { user, setUser, scans } = useDash()
  const router = useRouter()
  // Open the page named in the hash straight away, so /settings#plan lands on billing without flashing the profile page.
  const [active, setActive] = useState(() => {
    const h = typeof window === 'undefined' ? '' : window.location.hash.slice(1)
    return PAGES.some(([id]) => id === h) ? h : 'profile'
  })
  const [name, setName] = useState(user.name)
  const [saved, setSaved] = useState(false)
  const [notif, setNotif] = useState(user.preferences || { high: true, certs: true, weekly: false })
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [photoErr, setPhotoErr] = useState('')
  const fileRef = useRef(null)
  const plan = usePlan(user.id)
  const planInfo = PLANS[plan.id]
  const now = new Date()
  const monthScans = scans.filter((x) => { const d = new Date(x.created_at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() }).length
  const resetOn = new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  const usage = [
    ['Link checks', monthScans, planInfo.limits.checks],
    ['Message analyses', 0, planInfo.limits.messages],
    ['Monitored domains', Math.min(5, planInfo.limits.domains === Infinity ? 5 : planInfo.limits.domains), planInfo.limits.domains],
  ]

  // Each settings page is addressable by hash (#profile, #plan, …).
  useEffect(() => {
    const h = window.location.hash.slice(1)
    if (PAGES.some(([id]) => id === h)) setActive(h)
  }, [])
  const go = (id) => {
    setActive(id)
    setNotice('')
    window.history.replaceState(null, '', `#${id}`)
  }

  // Resize to a 256px square before uploading, so the photo stays small.
  const onPhoto = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return setPhotoErr('Use a JPG, PNG or WebP image.')
    if (file.size > 2 * 1024 * 1024) return setPhotoErr('Images must be 2 MB or smaller.')
    setPhotoErr('')
    const img = new Image()
    img.onload = async () => {
      const size = 256
      const c = document.createElement('canvas')
      c.width = c.height = size
      const s = Math.min(img.width, img.height)
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size)
      setSaving(true)
      try {
        const blob = await new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', 0.86))
        if (!blob) throw new Error('Could not prepare this photo.')
        setUser(await uploadAvatar(blob))
      }
      catch (failure) { setPhotoErr(failure.message) }
      finally { setSaving(false); URL.revokeObjectURL(img.src) }
    }
    img.onerror = () => { setPhotoErr('That file could not be read.'); URL.revokeObjectURL(img.src) }
    img.src = URL.createObjectURL(file)
  }

  const removePhoto = async () => {
    setSaving(true)
    try { setUser(await removeAvatar()); setPhotoErr('') }
    catch (failure) { setPhotoErr(failure.message) }
    finally { setSaving(false) }
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      setUser(await updateUser({ name: name.trim() || user.name, preferences: notif }))
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    } catch (failure) { setPhotoErr(failure.message) }
    finally { setSaving(false) }
  }

  const savePreferences = async () => {
    setSaving(true)
    setNotice('')
    try {
      setUser(await updateUser({ preferences: notif }))
      setNotice('Preferences saved.')
    } catch (failure) { setNotice(failure.message) }
    finally { setSaving(false) }
  }

  const sendReset = async () => {
    setSaving(true)
    setNotice('')
    try { await resetPassword(user.email); setNotice('Check your email for a password reset link.') }
    catch (failure) { setNotice(failure.message) }
    finally { setSaving(false) }
  }

  return (
    <>
      <div className="stw">
        <aside className="stw__aside">
          <PageHead title="Settings" />
          <nav className="stw__nav" aria-label="Settings" role="tablist">
            {PAGES.map(([id, label, icon]) => (
              <button key={id} type="button" role="tab" aria-selected={active === id} className={`stw__link${active === id ? ' is-on' : ''}`} onClick={() => go(id)}>{icon}<span>{label}</span></button>
            ))}
          </nav>
        </aside>

        <div className="st">
          {active === 'profile' && <section className="st__sec" id="profile">
            <header className="st__head">
              <h2>Profile</h2>
              <p>How you appear in this workspace.</p>
            </header>
            <form className="st__card" onSubmit={save}>
              <div className="st__profile">
                <Avatar src={user.avatar} size={64} />
                <div className="st__who">
                  <p className="st__name">{user.name}</p>
                  <p className="st__mail">{user.email}</p>
                  {photoErr && <p className="photo__err" role="alert">{photoErr}</p>}
                </div>
                <div className="st__photo-btns">
                  {user.avatar && <button type="button" className="btn btn--ghost" disabled={saving} onClick={removePhoto}>Remove</button>}
                  <button type="button" className="btn btn--soft" disabled={saving} onClick={() => fileRef.current?.click()}>
                    {user.avatar ? 'Change photo' : 'Upload photo'}
                  </button>
                </div>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onPhoto} />
              </div>
              <div className="st__fields">
                <label className="field">
                  <span>Full name</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <label className="field">
                  <span>Email</span>
                  <input value={user.email} disabled />
                </label>
              </div>
              <div className="st__foot">
                <span className="caption grey">JPG, PNG or WebP photos up to 2 MB.</span>
                <button className="btn btn--ink" type="submit" disabled={saving}>{saved ? 'Saved' : 'Save changes'}</button>
              </div>
            </form>
          </section>}

          {active === 'notifications' && <section className="st__sec" id="notifications">
            <header className="st__head">
              <h2>Notifications</h2>
              <p>Preferences are saved to your account. Email delivery is not connected yet.</p>
            </header>
            <div className="st__card st__list">
              {ALERTS.map(([k, t, d]) => (
                <div key={k} className="st__row">
                  <div>
                    <p className="st__t">{t}</p>
                    <p className="st__d">{d}</p>
                  </div>
                  <Toggle checked={!!notif[k]} onChange={(v) => setNotif((n) => ({ ...n, [k]: v }))} label={t} />
                </div>
              ))}
              <div className="st__foot st__foot--list">
                <span className="caption grey" role="status">{notice}</span>
                <button className="btn btn--ink" disabled={saving} onClick={savePreferences}>Save preferences</button>
              </div>
            </div>
          </section>}

          {active === 'password' && <section className="st__sec" id="password">
            <header className="st__head">
              <h2>Password</h2>
              <p>Set or reset your account password through email.</p>
            </header>
            <div className="st__card st__danger">
              <div>
                <p className="st__t">Reset password</p>
                <p className="st__d">{notice || `We will email a secure reset link to ${user.email}.`}</p>
              </div>
              <button className="btn btn--soft" disabled={saving} onClick={sendReset}>Send reset email</button>
            </div>
          </section>}

          {active === 'plan' && <section className="st__sec" id="plan">
            <header className="st__head">
              <h2>Plan &amp; billing</h2>
              <p>Your subscription and this month&apos;s usage.</p>
            </header>
            <div className="st__card bl__hero">
              <div className="bl__hero-top">
                <div>
                  <p className="bl__k">Current plan</p>
                  <div className="bl__name">
                    <h3>{planInfo.name}</h3>
                    <span className="bl__badge">{planInfo.monthly ? (plan.cycle === 'yearly' ? 'Yearly' : 'Monthly') : 'Free'}</span>
                  </div>
                  <p className="st__d">{planInfo.blurb}</p>
                </div>
                <div className="bl__cost">
                  <p className="bl__price">{inr(priceFor(planInfo, plan.cycle))}<span>/ month</span></p>
                  {planInfo.monthly > 0 && plan.cycle === 'yearly' && <p className="st__d">{inr(chargeFor(planInfo, plan.cycle))} billed yearly</p>}
                </div>
              </div>
              <dl className="bl__facts">
                <div><dt>Billing period</dt><dd>{planInfo.monthly ? (plan.cycle === 'yearly' ? 'Yearly' : 'Monthly') : 'None'}</dd></div>
                <div><dt>{planInfo.monthly ? 'Renews on' : 'Usage resets'}</dt><dd>{planInfo.monthly && plan.renews ? fmtDate(plan.renews) : resetOn}</dd></div>
                <div><dt>Payment method</dt><dd>{planInfo.monthly ? 'UPI · webassure@upi' : 'Not required'}</dd></div>
              </dl>
              <div className="bl__actions">
                {plan.id !== 'teams' && <Link href="/dashboard/upgrade" className="btn btn--ink">Upgrade plan</Link>}
                <Link href="/dashboard/upgrade" className="btn btn--soft">Compare plans</Link>
              </div>
            </div>

            <div className="st__card">
              <div className="bl__sec-head">
                <p className="st__t">Usage this month</p>
                <p className="st__d">Resets {resetOn}</p>
              </div>
              <div className="bl__meters">
                {usage.map(([label, usedN, limit]) => {
                  const unlimited = limit === Infinity
                  const pct = unlimited ? 100 : Math.min(100, (usedN / limit) * 100)
                  return (
                    <div key={label} className="bl__meter">
                      <p className="bl__meter-k">{label}</p>
                      <p className="bl__meter-v">{usedN.toLocaleString()}<span>{unlimited ? ' · Unlimited' : ` / ${limit.toLocaleString()}`}</span></p>
                      <span className="bl__bar"><span data-hot={!unlimited && pct >= 80 || undefined} data-unl={unlimited || undefined} style={{ width: `${pct}%` }} /></span>
                      <p className="bl__meter-f">{unlimited ? 'No limit on your plan' : `${Math.max(0, limit - usedN).toLocaleString()} remaining`}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="st__card">
              <div className="bl__sec-head">
                <p className="st__t">Billing history</p>
                <p className="st__d">Amounts include 18% GST</p>
              </div>
              {planInfo.monthly && plan.since ? (
                <div className="bl__table" role="table" aria-label="Invoices">
                  <div className="bl__tr bl__th" role="row"><span>Date</span><span>Description</span><span>Amount</span><span>Status</span></div>
                  <div className="bl__tr" role="row">
                    <span>{fmtDate(plan.since)}</span>
                    <span>WebAssure {planInfo.name} · {plan.cycle === 'yearly' ? 'Yearly' : 'Monthly'}</span>
                    <span>{inr(Math.round(chargeFor(planInfo, plan.cycle) * 1.18))}</span>
                    <span><em className="bl__paid">Paid</em></span>
                  </div>
                </div>
              ) : (
                <p className="bl__empty">No invoices yet. They appear here after your first payment.</p>
              )}
            </div>
          </section>}

          {active === 'accounts' && <section className="st__sec" id="accounts">
            <header className="st__head">
              <h2>Connected accounts</h2>
              <p>Link your own accounts so WebAssure can check messages where they arrive.</p>
            </header>
            <ConnectedAccounts userId={user.id} />
          </section>}

          {active === 'session' && <section className="st__sec" id="session">
            <header className="st__head">
              <h2>Session</h2>
              <p>Sign out of WebAssure on all devices.</p>
            </header>
            <div className="st__card st__danger">
              <div>
                <p className="st__t">Log out</p>
                <p className="st__d">{photoErr || 'You can sign back in at any time.'}</p>
              </div>
              <button className="btn btn--danger" onClick={async () => {
                try { await signOut(); router.replace('/login') }
                catch (failure) { setPhotoErr(failure.message) }
              }}>Log out</button>
            </div>
          </section>}
        </div>
      </div>
    </>
  )
}
