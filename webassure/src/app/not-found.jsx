import Link from 'next/link'
import Thermal from '../components/Thermal.jsx'

export const metadata = { title: 'Page not found', robots: { index: false } }

export default function NotFound() {
  return (
    <main className="nf">
      <div className="nf__body">
        <div className="nf__mark" aria-hidden="true">
          <Thermal text="404" viewBox="250 -10 400 200" />
        </div>
        <h1 className="nf__t">This page doesn&apos;t exist.</h1>
        <p className="nf__d">The link may be mistyped or the page may have moved. Unlike a phishing site, we&apos;ll tell you so.</p>
        <div className="nf__actions">
          <Link href="/" className="btn btn--ink">Back to home</Link>
          <Link href="/dashboard" className="btn btn--soft">Open dashboard</Link>
        </div>
      </div>
    </main>
  )
}
