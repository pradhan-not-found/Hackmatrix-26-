import Link from 'next/link'

export const metadata = { title: 'Page not found', robots: { index: false } }

export default function NotFound() {
  return (
    <main className="nf">
      <Link href="/" className="wordmark">webassure</Link>
      <div className="nf__body">
        <p className="eyebrow">404</p>
        <h1 className="t-statement">This page does not exist.</h1>
        <p className="grey">The link may be mistyped, or the page has moved. Unlike a phishing site, we will tell you so.</p>
        <div className="nf__actions">
          <Link href="/" className="btn btn--ink">Back to home</Link>
          <Link href="/dashboard" className="btn btn--ghost">Open dashboard</Link>
        </div>
      </div>
    </main>
  )
}
