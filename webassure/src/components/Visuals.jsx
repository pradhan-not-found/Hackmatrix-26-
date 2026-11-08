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
function MiniSite({ host, fake, d }) {
  return (
    <div className={`ms va${fake ? ' ms--fake' : ''}`} style={{ '--d': d }}>
      <div className="ms__bar">
        <span className={`ms__url${fake ? ' ms__url--bad' : ''}`}>{fake ? <Warn /> : <Lock />}{host}</span>
        <span className={`ms__tag chip chip--${fake ? 'bad' : 'ok'}`}>{fake ? 'Look-alike' : 'Original'}</span>
      </div>
      <div className="ms__page">
        <div className="ms__brand"><span className="ms__logo">S</span><span>State Bank</span></div>
        <p className="ms__h">Log in to Internet Banking</p>
        <span className="ms__label">Username</span>
        <span className="ms__input">rahul.k</span>
        <span className="ms__label">Password</span>
        <span className="ms__input">••••••••</span>
        <span className="ms__btn">Log in</span>
      </div>
    </div>
  )
}

export function PhishingVisual() {
  return (
    <Window url="secure-sbi-kyc-update.xyz/login" chip="Phishing" tone="bad" bg="blue">
      <div className="cmp2">
        <MiniSite host="onlinesbi.sbi" d="120ms" />
        <span className="cmp2__match va" style={{ '--d': '260ms' }}>
          <b>94%</b>
          <span>visual match</span>
        </span>
        <MiniSite host="sbi-kyc-update.xyz" fake d="200ms" />
      </div>
      <div className="vd va" style={{ '--d': '360ms' }}>
        <span className="vd__icon"><Warn /></span>
        <span className="vd__txt">
          <b>Phishing</b>
          <span>Copies the bank&apos;s login page on an unrelated domain</span>
        </span>
        <span className="vd__score">82<span>/100</span></span>
      </div>
    </Window>
  )
}

/* 02 Certificate intelligence */
const Tick = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12.5 4 4 8-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
const Cross = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
const Bang = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.5v7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /><circle cx="12" cy="17.5" r="1.7" fill="currentColor" /></svg>
const MARK = { ok: <Tick />, bad: <Cross />, warn: <Bang /> }

export function CertificateVisual() {
  const chain = [
    ['Root CA', 'ISRG Root X1', 'Trusted root', 'ok'],
    ['Intermediate', 'Unverified CA', 'Not in any trust store', 'bad'],
    ['Site certificate', '*.portal-login.in', 'Wildcard on a new domain', 'warn'],
  ]
  const facts = [
    ['Key', 'RSA 1024', 'Weak', 'bad'],
    ['Issued', '2 days ago', 'New', 'warn'],
    ['CT logs', '0 of 3', 'Missing', 'bad'],
  ]
  return (
    <Window url="portal-login.in" chip="Untrusted chain" tone="bad" bg="peach">
      <div className="cert">
        <div className="cert__chain">
          <p className="cert__h va" style={{ '--d': '80ms' }}>Certificate chain</p>
          {chain.map(([role, name, note, t], i) => (
            <div key={role} className={`cert__step cert__step--${t} va`} style={{ '--d': `${140 + i * 90}ms` }}>
              <span className={`cert__mark cert__mark--${t}`}>{MARK[t]}</span>
              <span className="cert__txt">
                <span className="cert__role">{role}</span>
                <span className="cert__name">{name}</span>
                <span className={`cert__note cert__note--${t}`}>{note}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="cert__facts">
          <p className="cert__h va" style={{ '--d': '80ms' }}>Key facts</p>
          {facts.map(([k, v, tag, t], i) => (
            <div key={k} className="cert__fact va" style={{ '--d': `${200 + i * 80}ms` }}>
              <span className="cert__k">{k}</span>
              <span className="cert__v">{v}</span>
              <span className={`chip chip--${t}`}>{tag}</span>
            </div>
          ))}
        </div>
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
