'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDash } from './context.js'
import { removeAvatar, resetPassword, signOut, updateUser, uploadAvatar } from '../../lib/auth.js'
import { PersonPlaceholder } from '../../components/Icons.jsx'
import { PageHead, Toggle } from './ui.jsx'

const ALERTS = [
  ['high', 'High-risk scan detected', 'When an investigation is classified High Risk or Confirmed Malicious.'],
  ['certs', 'Certificate alerts', 'Expiry within 14 days, weak keys or missing CT entries.'],
  ['weekly', 'Weekly summary', 'A digest of scans and threats every Monday.'],
]

export default function Settings() {
  const { user, setUser } = useDash()
  const router = useRouter()
  const [name, setName] = useState(user.name)
  const [saved, setSaved] = useState(false)
  const [notif, setNotif] = useState(user.preferences)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [photoErr, setPhotoErr] = useState('')
  const fileRef = useRef(null)

  // Resize to a 256px square before storing, so the photo stays small.
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
    } catch (failure) { setPhotoErr(failure.message) }
    finally { setSaving(false) }
  }

  return (
    <>
      <PageHead title="Settings" sub="Profile, preferences and account security." />

      {notice && <p role="status">{notice}</p>}
      <div className="st">
        <section className="st__sec">
          <header className="st__head">
            <h2>Profile</h2>
            <p>How you appear in this workspace.</p>
          </header>
          <form className="st__card" onSubmit={save}>
            <div className="st__profile">
              <span className="photo__img st__avatar">
                {user.avatar ? <img src={user.avatar} alt="" /> : <PersonPlaceholder />}
              </span>
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
        </section>

        <section className="st__sec">
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
                <Toggle checked={notif[k]} onChange={(v) => setNotif((n) => ({ ...n, [k]: v }))} label={t} />
              </div>
            ))}
            <div><button className="btn btn--ink" disabled={saving} onClick={savePreferences}>Save preferences</button></div>
          </div>
        </section>

        <section className="st__sec">
          <header className="st__head"><h2>Password</h2><p>Set or reset your account password through email.</p></header>
          <div className="st__card">
            <button className="btn btn--ghost" disabled={saving} onClick={async () => {
              setSaving(true)
              try { await resetPassword(user.email); setNotice('Check your email for a password reset link.') }
              catch (failure) { setPhotoErr(failure.message) }
              finally { setSaving(false) }
            }}>Send password reset email</button>
          </div>
        </section>

        <section className="st__sec">
          <header className="st__head">
            <h2>Session</h2>
            <p>Sign out of WebAssure on all devices.</p>
          </header>
          <div className="st__card st__danger">
            <div>
              <p className="st__t">Log out</p>
              <p className="st__d">You can sign back in at any time.</p>
            </div>
            <button className="btn btn--danger" onClick={async () => {
              try { await signOut(); router.replace('/login') }
              catch (failure) { setPhotoErr(failure.message) }
            }}>Log out</button>
          </div>
        </section>
      </div>
    </>
  )
}
