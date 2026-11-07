'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDash } from './context.js'
import { removeAvatar, resetPassword, signOut, updateUser, uploadAvatar } from '../../lib/auth.js'
import Avatar from '../../components/Avatar.jsx'
import { PageHead, Toggle } from './ui.jsx'

const PAGES = [
  ['profile', 'Profile'],
  ['notifications', 'Notifications'],
  ['password', 'Password'],
  ['plan', 'Plan & billing'],
  ['session', 'Session'],
]

const PLANS = [
  { name: 'Personal', price: '₹0', per: ' / month', current: true, features: ['50 checks a month', 'Phishing and scam detection', 'Plain-language reports'] },
  { name: 'Pro', price: '₹416', per: ' / month, billed yearly', cta: 'Upgrade to Pro', features: ['Unlimited checks', 'Certificate monitoring for 10 domains', 'Evidence export and alerts'] },
  { name: 'Teams', price: '₹2,083', per: ' / month, billed yearly', cta: 'Upgrade to Teams', features: ['REST API and webhooks', 'Brand impersonation monitoring', 'SSO and priority support'] },
]

const ALERTS = [
  ['high', 'High-risk scan detected', 'When an investigation is classified High Risk or Confirmed Malicious.'],
  ['certs', 'Certificate alerts', 'Expiry within 14 days, weak keys or missing CT entries.'],
  ['weekly', 'Weekly summary', 'A digest of scans and threats every Monday.'],
]

export default function Settings() {
  const { user, setUser, scans } = useDash()
  const router = useRouter()
  const [active, setActive] = useState('profile')
  const [name, setName] = useState(user.name)
  const [saved, setSaved] = useState(false)
  const [notif, setNotif] = useState(user.preferences || { high: true, certs: true, weekly: false })
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [photoErr, setPhotoErr] = useState('')
  const fileRef = useRef(null)
  const used = Math.min(50, scans.length)

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
      <PageHead title="Settings" />

      <div className="stw">
        <nav className="stw__nav" aria-label="Settings" role="tablist">
          {PAGES.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={active === id} className={`stw__link${active === id ? ' is-on' : ''}`} onClick={() => go(id)}>{label}</button>
          ))}
        </nav>

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
              <p>You are on the Personal plan. Upgrade any time.</p>
            </header>
            <div className="pl">
              {PLANS.map((p) => (
                <article key={p.name} className="pl__card" data-current={p.current || undefined}>
                  <div className="pl__top">
                    <p className="pl__name">{p.name}</p>
                    {p.current && <span className="pl__tag">Current plan</span>}
                  </div>
                  <p className="pl__price">{p.price}<span>{p.per}</span></p>
                  <ul className="pl__list">{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
                  {p.current
                    ? <button className="btn btn--ghost btn--block" disabled>Current plan</button>
                    : <button className="btn btn--ink btn--block">{p.cta}</button>}
                </article>
              ))}
            </div>
            <div className="st__card pl__usage">
              <div>
                <p className="st__t">This month&apos;s usage</p>
                <p className="st__d">{used} of 50 free checks used</p>
              </div>
              <span className="pl__meter"><span style={{ width: `${(used / 50) * 100}%` }} /></span>
            </div>
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
