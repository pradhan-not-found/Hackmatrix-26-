// Certificate inspector: one clean window — header, trust chain, details, CT result.

const CHAIN = [
  { role: 'Root CA', name: 'ISRG Root X1', tone: 'ok' },
  { role: 'Intermediate', name: 'Unverified CA', tone: 'bad' },
  { role: 'Site', name: '*.portal-login.in', tone: 'bad' },
]

const DETAILS = [
  ['Issued', '2 days ago', 'warn'],
  ['Valid until', 'Feb 3, 2027', ''],
  ['Key', 'RSA 1024 · weak', 'bad'],
  ['Signature', 'SHA-256', ''],
  ['Issuer trust', 'Unknown', 'bad'],
  ['Protocol', 'TLS 1.3', ''],
]

const Chevron = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
)

export default function CertificateVisual() {
  return (
    <div className="vis vis--peach">
      <div className="cv va" style={{ '--d': '0ms' }}>
        <div className="cv__bar">
          <span className="cv__dots"><i /><i /><i /></span>
          <span className="cv__url">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="11" width="12" height="9" rx="2" fill="currentColor" /><path d="M8.5 11V8.5a3.5 3.5 0 0 1 7 0V11" fill="none" stroke="currentColor" strokeWidth="2.2" /></svg>
            *.portal-login.in
          </span>
          <span className="cv__issues">3 issues</span>
        </div>

        <div className="cv__body">
          <p className="cv__label">Trust chain</p>
          <div className="cv__chain">
            {CHAIN.map((c, i) => (
              <div key={c.role} className="cv__chainwrap">
                <div className="cv__node va" style={{ '--d': `${120 + i * 90}ms` }}>
                  <span className="cv__role">{c.role}</span>
                  <span className="cv__name"><span className={`cv__dot cv__dot--${c.tone}`} />{c.name}</span>
                </div>
                {i < CHAIN.length - 1 && <span className="cv__chev"><Chevron /></span>}
              </div>
            ))}
          </div>

          <p className="cv__label">Certificate</p>
          <dl className="cv__grid">
            {DETAILS.map(([k, v, t]) => (
              <div key={k} className="cv__cell">
                <dt>{k}</dt>
                <dd data-tone={t || undefined}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="cv__ct va" style={{ '--d': '420ms' }}>
          <span className="cv__ctl"><span className="cv__dot cv__dot--bad" />Certificate Transparency</span>
          <span className="cv__ctv">Not found in 3 of 3 public logs</span>
        </div>
      </div>
    </div>
  )
}
