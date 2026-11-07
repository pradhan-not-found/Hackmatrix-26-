import Link from 'next/link'

export const metadata = { title: 'Page not found', robots: { index: false } }

export default function NotFound() {
  return (
    <main className="nf">
      <div className="nf__body">
        <p className="nf__code" aria-hidden="true">404</p>
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
