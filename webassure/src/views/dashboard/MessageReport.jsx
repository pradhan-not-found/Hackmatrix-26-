'use client'

// Result of a message analysis: verdict header with score ring, the message as
// a received bubble with flagged phrases highlighted, numbered findings,
// recommendation with extracted entities, AI explanation and limitations.

const TONE = { High: 'bad', Medium: 'warn', Low: 'ok' }
const LABEL = { bad: 'High risk', warn: 'Needs caution', ok: 'Low risk' }

const Icon = ({ d, size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
)
const ICONS = {
  bad: <><path d="M12 3 2.8 19a1.2 1.2 0 0 0 1 1.8h16.4a1.2 1.2 0 0 0 1-1.8z" /><path d="M12 9.5v4.5M12 17.2h.01" /></>,
  warn: <><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5h.01" /></>,
  ok: <><path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6z" /><path d="m8.8 12.2 2.3 2.3 4.2-4.6" /></>,
  advice: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.6h.01" /></>,
  spark: <><path d="M12 3.5 13.9 9 19.5 11 13.9 13 12 18.5 10.1 13 4.5 11 10.1 9z" /><path d="M18.5 3.5v3M17 5h3" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" /><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" /></>,
  phone: <path d="M5 4h3l1.5 4-2 1.3a11 11 0 0 0 5.2 5.2l1.3-2 4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z" />,
  mail: <><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="m3.5 7 8.5 6 8.5-6" /></>,
}

function Ring({ value, tone }) {
  const r = 30, c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div className={`mr__ring mr--${tone}`} role="img" aria-label={`Indicator score ${v} out of 100`}>
      <svg viewBox="0 0 72 72" width="88" height="88">
        <circle cx="36" cy="36" r={r} className="mr__ring-track" />
        <circle cx="36" cy="36" r={r} className="mr__ring-fill" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} />
      </svg>
      <span className="mr__ring-n">{v}<small>/100</small></span>
    </div>
  )
}

function Highlighted({ text, spans }) {
  if (!spans.length) return text
  const escaped = spans.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).sort((a, b) => b.length - a.length)
  const parts = text.split(new RegExp(`(${escaped.join('|')})`, 'gi'))
  return parts.map((p, i) => (spans.some((s) => s.toLowerCase() === p.toLowerCase()) ? <mark key={i}>{p}</mark> : p))
}

export default function MessageReport({ report, text, onExplain, explaining }) {
  const tone = TONE[report.risk_level] || 'warn'
  const spans = report.indicators.flatMap((i) => i.evidence)
  const ai = report.ai_explanation
  const entities = [
    ['link', 'Link', report.extracted_urls],
    ['phone', 'Phone', report.extracted_phone_numbers],
    ['mail', 'Email', report.extracted_email_addresses],
  ].flatMap(([icon, type, values]) => (values || []).map((v) => ({ icon, type, v })))

  return (
    <section className="mr" aria-live="polite">
      <div className={`card mr__head mr--${tone}`}>
        <span className="mr__status"><Icon d={ICONS[tone]} size={22} /></span>
        <div className="mr__head-main">
          <p className="mr__k">Assessment</p>
          <h2 className="mr__title">{report.classification}</h2>
          <div className="mr__meta">
            <span className="mr__pill">{LABEL[tone]}</span>
            {report.confidence != null && <span className="mr__muted">Model confidence {Math.round(report.confidence * 100)}%</span>}
            <span className="mr__muted">{report.indicators.length} indicator{report.indicators.length === 1 ? '' : 's'} matched</span>
          </div>
        </div>
        <Ring value={report.heuristic_risk_score} tone={tone} />
      </div>

      <div className="mr__grid">
        <div className="card mr__card">
          <h3 className="mr__h">Message</h3>
          <div className="mr__bubble"><Highlighted text={text} spans={spans} /></div>

          <h3 className="mr__h mr__h--gap">What we found</h3>
          {report.indicators.length ? (
            <ol className="mr__finds">
              {report.indicators.map((i, n) => (
                <li key={i.code}>
                  <span className="mr__num">{String(n + 1).padStart(2, '0')}</span>
                  <div>
                    <p className="mr__find-t">{i.name}</p>
                    {i.evidence.length > 0 && <div className="mr__chips">{i.evidence.map((e) => <span key={e}>{e}</span>)}</div>}
                  </div>
                </li>
              ))}
            </ol>
          ) : <p className="mr__muted">No scam indicators matched in this text.</p>}
        </div>

        <div className="mr__side">
          <div className={`card mr__card mr__advice mr--${tone}`}>
            <div className="mr__advice-h"><Icon d={ICONS.advice} /><h3 className="mr__h">What to do</h3></div>
            <p className="mr__rec">{report.recommendation}</p>
          </div>

          {entities.length > 0 && (
            <div className="card mr__card">
              <h3 className="mr__h">Extracted from the message</h3>
              <ul className="mr__ents">
                {entities.map(({ icon, type, v }) => (
                  <li key={type + v}>
                    <span className="mr__ent-ic"><Icon d={ICONS[icon]} size={15} /></span>
                    <span className="mr__ent-type">{type}</span>
                    <code>{v}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="card mr__card">
            <div className="mr__ai-h">
              <div className="mr__advice-h"><Icon d={ICONS.spark} /><h3 className="mr__h">AI explanation</h3></div>
              {!ai && onExplain && <button className="btn btn--soft mr__ai-btn" onClick={onExplain} disabled={explaining}>{explaining ? 'Explaining…' : 'Explain'}</button>}
            </div>
            {ai ? (ai.status === 'unavailable'
              ? <p className="mr__muted">{ai.reason}</p>
              : <div className="mr__ai">
                  {ai.summary && <p>{ai.summary}</p>}
                  {(ai.statements || ai.points || []).map((s, i) => <p key={i}>{s.text || s.statement || String(s)}</p>)}
                </div>)
              : <p className="mr__muted">{report.explanation || 'Get a plain-language summary of these findings. Only the findings are sent, not your message.'}</p>}
          </div>
        </div>
      </div>

      {report.limitations?.length > 0 && (
        <details className="mr__lim">
          <summary>Limitations of this check</summary>
          <ul>{report.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
        </details>
      )}
    </section>
  )
}
