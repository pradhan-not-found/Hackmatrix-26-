'use client'

import ScrollText from './ScrollText.jsx'
import ThermalIcon from './ThermalIcon.jsx'

const STEPS = [
  ['Submit', 'Paste a URL, domain, email or message. Nothing opens on your device.', 'link'],
  ['Analyse', 'Every check runs in parallel in an isolated sandbox.', 'radar'],
  ['Explain', 'A 0–100 score with every indicator and its evidence.', 'gauge'],
  ['Share', 'Confirmed threats are shared so everyone is protected.', 'nodes'],
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
      <ol className="steps">
        {STEPS.map(([t, d, shape], i) => (
          <li key={t} className="step reveal" style={{ transitionDelay: `${i * 90}ms` }}>
            <span className="step__art"><ThermalIcon shape={shape} size={96} /></span>
            <span className="step__n">{String(i + 1).padStart(2, '0')}</span>
            <h3 className="step__t">{t}</h3>
            <p className="step__d">{d}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
