// "What we do" scenes. All four share one app-window design so they read as a set.

const Lock = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="11" width="12" height="9" rx="2" fill="currentColor" /><path d="M8.5 11V8.5a3.5 3.5 0 0 1 7 0V11" fill="none" stroke="currentColor" strokeWidth="2.2" /></svg>
)
const Warn = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l10 18H2z" fill="currentColor" /></svg>
)

function Window({ url, secure, chip, tone, bg, children }) {
  return (
    <div className={`vis vis--${bg}`}>
      <div className="win va" style={{ '--d': '0ms' }}>
        <div className="win__bar">
          <span className="win__dots"><i /><i /><i /></span>
          <span className={`win__url${secure ? '' : ' win__url--bad'}`}>{secure ? <Lock /> : <Warn />}{url}</span>
          <span className={`chip chip--${tone}`}>{chip}</span>
        </div>
        <div className="win__body">{children}</div>
      </div>
    </div>
  )
}

const Row = ({ k, v, tone, d }) => (
  <div className="win__row va" style={{ '--d': d }}>
    <span className="win__k">{k}</span>
    <span className={`win__v${tone ? ` win__v--${tone}` : ''}`}>{v}</span>
  </div>
)

/* 01 Phishing detection */
export function PhishingVisual() {
  return (
    <Window url="secure-sbi-kyc-update.xyz/login" chip="Phishing" tone="bad" bg="blue">
      <div className="cmp">
        {[['Original', 'onlinesbi.sbi', 'ok'], ['Clone', 'secure-sbi-kyc-update.xyz', 'bad']].map(([label, host, t], i) => (
          <div key={label} className="cmp__site va" style={{ '--d': `${120 + i * 90}ms` }}>
            <div className="cmp__page">
              <span className="cmp__logo" />
              <span className="cmp__line" />
              <span className="cmp__field" />
              <span className="cmp__field" />
              <span className="cmp__btn" />
            </div>
            <div className="cmp__meta">
              <span className={`sd sd--${t}`} />
              <span className="cmp__label">{label}</span>
              <span className="cmp__host">{host}</span>
            </div>
          </div>
        ))}
        <span className="cmp__match va" style={{ '--d': '300ms' }}>94% match</span>
      </div>
      <div className="rs va" style={{ '--d': '380ms' }}>
        <span className="rs__k">Risk score</span>
        <span className="rs__track"><span style={{ width: '82%' }} /></span>
        <span className="rs__n">82</span>
      </div>
    </Window>
  )
}

/* 02 Certificate intelligence */
export function CertificateVisual() {
  const chain = [['Root CA', 'ISRG Root X1', 'ok'], ['Intermediate', 'Unverified CA', 'bad'], ['Site', '*.portal-login.in', 'bad']]
  return (
    <Window url="portal-login.in" secure chip="3 issues" tone="bad" bg="peach">
      <div className="chain">
        {chain.map(([role, name, t], i) => (
          <div key={role} className="chain__node va" style={{ '--d': `${120 + i * 80}ms` }}>
            <span className="chain__role">{role}</span>
            <span className="chain__name"><span className={`sd sd--${t}`} />{name}</span>
          </div>
        ))}
      </div>
      <div className="win__list">
        <Row k="Issued" v="2 days ago" tone="warn" d="320ms" />
        <Row k="Key" v="RSA 1024 · weak" tone="bad" d="380ms" />
        <Row k="Certificate Transparency" v="Not found in 3 logs" tone="bad" d="440ms" />
      </div>
    </Window>
  )
}

/* 03 Website security */
export function AuditVisual() {
  const checks = [
    ['Content-Security-Policy', 'Missing', 'bad'],
    ['Open redirect on /go?u=', 'Exploitable', 'bad'],
    ['jQuery 1.12.4', 'Outdated', 'warn'],
    ['HSTS', 'Enabled', 'ok'],
  ]
  return (
    <Window url="shop.example-store.in" secure chip="Grade D" tone="warn" bg="mint">
      <div className="grade va" style={{ '--d': '120ms' }}>
        <span className="grade__l">D</span>
        <span>
          <span className="grade__t">Security grade</span>
          <span className="grade__d">3 issues need attention</span>
        </span>
      </div>
      <div className="win__list">
        {checks.map(([k, v, t], i) => <Row key={k} k={k} v={v} tone={t} d={`${200 + i * 60}ms`} />)}
      </div>
    </Window>
  )
}

/* 04 Threat ledger */
export function LedgerVisual() {
  const reports = [
    ['#4821', 'secure-sbi-kyc-update.xyz', 12, 'Anchored', 'ok'],
    ['#4820', 'careers-infosys.work', 3, 'Pending', 'warn'],
    ['#4819', 'aadhaar-update-portal.in', 9, 'Anchored', 'ok'],
  ]
  return (
    <Window url="ledger.webassure.dev" secure chip="Tamper-proof" tone="ok" bg="lilac">
      <div className="win__list">
        {reports.map(([id, host, n, s, t], i) => (
          <div key={id} className="led va" style={{ '--d': `${120 + i * 80}ms` }}>
            <span className="led__id">{id}</span>
            <span className="led__host">{host}</span>
            <span className="led__conf"><span style={{ width: `${Math.min(100, (n / 12) * 100)}%` }} /></span>
            <span className={`chip chip--${t}`}>{s}</span>
          </div>
        ))}
      </div>
      <div className="hash va" style={{ '--d': '400ms' }}>
        <span className="hash__k">Latest block</span>
        <span className="hash__v">0x9f3a…c21e · #18,204,551</span>
      </div>
    </Window>
  )
}
