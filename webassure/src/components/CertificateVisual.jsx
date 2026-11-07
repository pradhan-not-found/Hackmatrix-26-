// Trust-chain inspector: chain on the left, selected certificate on the right,
// Certificate Transparency lookup underneath.

const CHAIN = [
  { role: 'Root CA', name: 'ISRG Root X1', state: 'ok', note: 'Trusted' },
  { role: 'Intermediate', name: 'Unverified CA', state: 'bad', note: 'Unknown issuer' },
  { role: 'Site certificate', name: '*.portal-login.in', state: 'bad', note: '3 issues', active: true },
]

const DETAILS = [
  ['Subject', '*.portal-login.in', ''],
  ['Issued', '2 days ago', 'warn'],
  ['Key', 'RSA 1024', 'bad'],
  ['Signature', 'SHA-256', ''],
  ['Valid until', 'Feb 3, 2027', ''],
]

export default function CertificateVisual() {
  return (
    <div className="vis vis--peach">
      <div className="ci">
        <ol className="ci__chain">
          {CHAIN.map((c, i) => (
            <li key={c.role} className="ci__node va" data-active={c.active || undefined} style={{ '--d': `${i * 110}ms` }}>
              <span className={`ci__dot ci__dot--${c.state}`} />
              <span className="ci__txt">
                <span className="ci__role">{c.role}</span>
                <span className="ci__name">{c.name}</span>
              </span>
              <span className={`ci__note ci__note--${c.state}`}>{c.note}</span>
            </li>
          ))}
        </ol>

        <div className="ci__card va" style={{ '--d': '300ms' }}>
          <div className="ci__head">
            <span className="ci__lock" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
            </span>
            <span>
              <span className="ci__title">Certificate details</span>
              <span className="ci__sub">TLS 1.3 · Domain validated</span>
            </span>
          </div>
          <dl className="ci__rows">
            {DETAILS.map(([k, v, t]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd data-tone={t || undefined}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="ci__ct va" style={{ '--d': '420ms' }}>
          <span className="ci__ct-k">CT log lookup</span>
          <span className="ci__ct-logs">
            <i data-miss />
            <i data-miss />
            <i data-miss />
          </span>
          <span className="ci__ct-v">Not found in 3 of 3 logs</span>
        </div>
      </div>
    </div>
  )
}
