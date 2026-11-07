'use client'

import ScrollText from './ScrollText.jsx'
import AsciiArt from './AsciiArt.jsx'

const STEPS = [
  ['Submit', 'Paste a URL, domain, email or message. Nothing opens on your device.', 'link', '#2cc5f9'],
  ['Analyse', 'Four engines run in parallel in an isolated sandbox.', 'radar', '#ff3d8b'],
  ['Explain', 'A 0–100 score with every indicator and its evidence.', 'gauge', '#ff7a1a'],
  ['Share', 'Confirmed threats join the shared, tamper-proof ledger.', 'nodes', '#2ee6a6'],
]

export default function Steps() {
  return (
    <section className="section wrap" id="how">
      <div className="wwd__head">
        <p className="eyebrow">How it works</p>
        <ScrollText
          className="t-statement wwd__statement"
          lead="From suspicious to understood in under five seconds."
          rest="No setup, no plugins, no security background needed."
        />
      </div>
      <ol className="steps reveal">
        {STEPS.map(([t, d, shape, color], i) => (
          <li key={t} className="step" style={{ '--i': i }}>
            <div className="step__art">
              <AsciiArt shape={shape} color={color} cols={22} rows={13} label={t} />
            </div>
            <div className="step__body">
              <span className="step__line"><span /></span>
              <span className="step__n">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="step__t">{t}</h3>
              <p className="step__d">{d}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
