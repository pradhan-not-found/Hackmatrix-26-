import Link from 'next/link'

export const metadata = { title: 'Page not found' }

const LINKS = [
  ['/dashboard/scans', 'Scans', 'Check a link and review past reports'],
  ['/dashboard/messages', 'Messages', 'Analyse a suspicious SMS or email'],
  ['/dashboard/certificates', 'Certificates', 'Monitor TLS certificates for your domains'],
  ['/dashboard/settings', 'Settings', 'Profile, notifications and billing'],
]

export default function DashboardNotFound() {
  return (
    <section className="dnf">
      <div className="dnf__card">
        <span className="dnf__code">404</span>
        <h1 className="dnf__t">This page isn&apos;t in your workspace</h1>
        <p className="dnf__d">The address may be mistyped, or the page has moved. Pick up from one of these instead.</p>
        <div className="dnf__actions">
          <Link href="/dashboard" className="btn btn--ink">Go to overview</Link>
          <Link href="/dashboard/scans" className="btn btn--soft">New scan</Link>
        </div>
      </div>
      <ul className="dnf__links">
        {LINKS.map(([href, title, desc]) => (
          <li key={href}>
            <Link href={href}>
              <span>
                <strong>{title}</strong>
                <em>{desc}</em>
              </span>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
