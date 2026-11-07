'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useDash } from './context.js'
import { signIn, signOut } from '../../lib/auth.js'
import { PageHead, Toggle } from './ui.jsx'

function newKey() {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  return 'wa_live_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export default function Settings() {
  const { user, setUser } = useDash()
  const router = useRouter()
  const [name, setName] = useState(user.name)
  const [saved, setSaved] = useState(false)
  const [notif, setNotif] = useState({ high: true, certs: true, weekly: false })
  const [key, setKey] = useState(newKey)
  const [copied, setCopied] = useState(false)

  const save = (e) => {
    e.preventDefault()
    setUser(signIn(user.email, name.trim() || user.name))
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

      <div className="settings">
        <section className="card panel set">
          <div className="set__label">
            <h2 className="panel__title">Profile</h2>
            <p className="caption grey">How you appear in this workspace.</p>
          </div>
          <form className="set__body" onSubmit={save}>
            <label className="field">
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field">
              <span>Email</span>
              <input value={user.email} disabled />
            </label>
            <div><button className="btn btn--ink" type="submit">{saved ? 'Saved' : 'Save changes'}</button></div>
          </form>
        </section>

        <section className="card panel set">
          <div className="set__label">
            <h2 className="panel__title">Notifications</h2>
            <p className="caption grey">Email alerts for this workspace.</p>
          </div>
          <div className="set__body">
            {[
              ['high', 'High-risk scan detected', 'When a scan scores 55 or above.'],
              ['certs', 'Certificate alerts', 'Expiry within 14 days, weak keys or missing CT entries.'],
              ['weekly', 'Weekly summary', 'A digest of scans and threats every Monday.'],
            ].map(([k, t, d]) => (
              <div key={k} className="set__row">
                <div>
                  <p className="set__t">{t}</p>
                  <p className="caption grey">{d}</p>
                </div>
                <Toggle checked={notif[k]} onChange={(v) => setNotif((n) => ({ ...n, [k]: v }))} label={t} />
              </div>
            ))}
          </div>
        </section>

        <section className="card panel set">
          <div className="set__label">
            <h2 className="panel__title">API key</h2>
            <p className="caption grey">Submit URLs and fetch reports programmatically.</p>
          </div>
          <div className="set__body">
            <div className="keybox">
              <code>{key.slice(0, 14)}••••••••••••{key.slice(-4)}</code>
              <button className="btn btn--ghost" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
              <button className="btn btn--ghost" onClick={() => setKey(newKey())}>Regenerate</button>
            </div>
            <p className="caption grey">Keep this key secret. Regenerating it revokes the old key immediately.</p>
          </div>
        </section>

        <section className="card panel set">
          <div className="set__label">
            <h2 className="panel__title">Session</h2>
            <p className="caption grey">Sign out of WebAssure on this device.</p>
          </div>
          <div className="set__body">
            <div><button className="btn btn--danger" onClick={() => { signOut(); router.push('/') }}>Log out</button></div>
          </div>
        </section>
      </div>
    </>
  )
}
