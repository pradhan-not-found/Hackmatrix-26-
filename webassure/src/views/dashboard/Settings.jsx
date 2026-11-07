'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDash } from './context.js'
import { signOut, updateUser } from '../../lib/auth.js'
import { PersonPlaceholder } from '../../components/Icons.jsx'
import { PageHead, Toggle } from './ui.jsx'

function newKey() {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  return 'wa_live_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

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
  const [notif, setNotif] = useState({ high: true, certs: true, weekly: false })
  const [key, setKey] = useState(newKey)
  const [copied, setCopied] = useState(false)
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
    img.onload = () => {
      const size = 256
      const c = document.createElement('canvas')
      c.width = c.height = size
      const s = Math.min(img.width, img.height)
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size)
      const next = updateUser({ avatar: c.toDataURL('image/jpeg', 0.86) })
      if (next) setUser(next)
      else setPhotoErr('Could not save the image. Try a smaller one.')
      URL.revokeObjectURL(img.src)
    }
    img.onerror = () => setPhotoErr('That file could not be read.')
    img.src = URL.createObjectURL(file)
  }

  const removePhoto = () => {
    const next = updateUser({ avatar: null })
    if (next) setUser(next)
  }

  const save = (e) => {
    e.preventDefault()
    const next = updateUser({ name: name.trim() || user.name })
    if (next) setUser(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(key)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <>
      <PageHead title="Settings" sub="Profile, notifications and API access." />

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
                {user.avatar && <button type="button" className="btn btn--ghost" onClick={removePhoto}>Remove</button>}
                <button type="button" className="btn btn--soft" onClick={() => fileRef.current?.click()}>
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
              <button className="btn btn--ink" type="submit">{saved ? 'Saved' : 'Save changes'}</button>
            </div>
          </form>
        </section>

        <section className="st__sec">
          <header className="st__head">
            <h2>Notifications</h2>
            <p>Choose which email alerts you receive.</p>
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
          </div>
        </section>

        <section className="st__sec">
          <header className="st__head">
            <h2>API key</h2>
            <p>Submit URLs and fetch reports programmatically.</p>
          </header>
          <div className="st__card">
            <div className="st__key">
              <code>{key.slice(0, 14)}••••••••••••{key.slice(-4)}</code>
              <button className="btn btn--soft" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
              <button className="btn btn--ghost" onClick={() => setKey(newKey())}>Regenerate</button>
            </div>
            <p className="st__d st__note">Keep this key secret. Regenerating it revokes the old key immediately.</p>
          </div>
        </section>

        <section className="st__sec">
          <header className="st__head">
            <h2>Session</h2>
            <p>Sign out of WebAssure on this device.</p>
          </header>
          <div className="st__card st__danger">
            <div>
              <p className="st__t">Log out</p>
              <p className="st__d">You can sign back in at any time.</p>
            </div>
            <button className="btn btn--danger" onClick={() => { signOut(); router.push('/') }}>Log out</button>
          </div>
        </section>
      </div>
    </>
  )
}
