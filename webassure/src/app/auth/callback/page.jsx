'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { dashboardPath, getUser } from '../../../lib/auth.js'

export default function AuthCallback() {
  const router = useRouter()
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const complete = async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const hash = new URLSearchParams(window.location.hash.slice(1))
        const failure = params.get('error_description') || hash.get('error_description') || params.get('error') || hash.get('error')
        if (failure) throw new Error(failure)
        // SDK initialization exchanges the PKCE code before getUser resolves.
        const user = await getUser()
        if (!user) throw new Error('Sign-in did not complete. Please try again in the same browser.')
        if (active) router.replace(dashboardPath(params.get('next')))
      } catch (failure) {
        if (active) setError(failure.message)
      }
    }
    complete()
    return () => { active = false }
  }, [router])
  return <main className="dash-loading">
    <span className="dl__mark">webassure</span>
    {error ? <><p role="alert">{error}</p><Link href="/login" className="btn btn--ghost">Back to sign in</Link></> : <p role="status">Completing sign-in…</p>}
  </main>
}
