// Real vs. clone comparison with a verdict bar.

function Site({ url, tone, fake }) {
  return (
    <div className={`pv__site${fake ? ' pv__site--fake' : ''}`}>
      <div className="pv__bar">
        <span className="pv__dots"><i /><i /><i /></span>
        <span className={`pv__url pv__url--${tone}`}>
          {tone === 'ok' ? (
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="11" width="12" height="9" rx="2" fill="currentColor" /><path d="M8.5 11V8.5a3.5 3.5 0 0 1 7 0V11" fill="none" stroke="currentColor" strokeWidth="2.2" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l10 18H2z" fill="currentColor" /></svg>
          )}
          {url}
        </span>
      </div>
      <div className="pv__page">
        <span className="pv__logo" />
        <span className="pv__h" />
        <span className="pv__input" />
        <span className="pv__input" />
        <span className="pv__btn" />
        {fake && <span className="pv__scan" aria-hidden="true" />}
      </div>
      <span className={`pv__label pv__label--${tone}`}>{fake ? 'Clone' : 'Original'}</span>
    </div>
  )
}

export default function PhishingVisual() {
  return (
    <div className="vis vis--blue">
      <div className="pv">
        <div className="pv__pair">
          <div className="va" style={{ '--d': '0ms' }}>
            <Site url="onlinesbi.sbi" tone="ok" />
          </div>
          <div className="pv__match va" style={{ '--d': '160ms' }}>
            <span className="pv__match-line" />
            <span className="pv__match-pill">94% match</span>
            <span className="pv__match-line" />
          </div>
          <div className="va" style={{ '--d': '80ms' }}>
            <Site url="secure-sbi-kyc-update.xyz" tone="bad" fake />
          </div>
        </div>

        <div className="pv__verdict va" style={{ '--d': '320ms' }}>
          <span className="pv__v-dot" />
          <span className="pv__v-t">Phishing</span>
          <span className="pv__v-d">Imitates SBI login on an unrelated domain</span>
          <span className="pv__v-score">
            <span className="pv__v-track"><span /></span>
            82<span className="pv__v-max">/100</span>
          </span>
        </div>
      </div>
    </div>
  )
}
