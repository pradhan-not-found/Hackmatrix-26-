'use client'

import Link from 'next/link'
import ScrollText from './ScrollText.jsx'
import ThermalIcon from './ThermalIcon.jsx'

const SIGNALS = [
  ['redirect', 'Redirect chains', 'Every hop followed to where the link really ends.'],
  ['spark', 'Impersonation', 'Look-alike brands flagged before you type a password.'],
  ['check', 'Verified originals', 'The real site confirmed, certificate and all.'],
]

const SECTORS = [
  ['Banking & fintech', 'Cloned logins, fake KYC and UPI requests', 'bank'],
  ['Universities', 'Fake admission portals and fee-payment links', 'cap'],
  ['Recruitment', 'Job offers that ask for a registration fee', 'briefcase'],
  ['E-commerce', 'Look-alike stores, fake refunds and delivery scams', 'cart'],
  ['Government services', 'Impersonated tax, ID and benefits portals', 'dome'],
  ['Payments', 'Fraudulent payment links and QR redirects', 'card'],
  ['Healthcare', 'Fake pharmacies and insurance claim pages', 'plus'],
  ['Enterprise IT', 'Credential harvesting aimed at your staff', 'server'],
]

const MOMENTS = [
  ['Before you click', 'A link arrives by SMS, email or WhatsApp and something feels off.'],
  ['Before you log in', 'The page looks like your bank, but the address is slightly different.'],
  ['Before you pay', 'A payment link, invoice or QR code asks for money up front.'],
  ['Before you launch', 'Your own site goes live and you want to know it is configured safely.'],
]

export default function Audience() {
  return (
    <section className="section wrap" id="who">
      <div className="wwd__head">
        <p className="eyebrow">Who it protects</p>
        <ScrollText
          className="t-statement wwd__statement"
          lead="Scammers copy the brands people already trust."
          rest="WebAssure is tuned for the sectors that are impersonated most, so the checks know what the real thing looks like."
        />
      </div>

      <div className="signals">
        {SIGNALS.map(([shape, title, text], i) => (
          <figure key={shape} className="signal reveal" style={{ transitionDelay: `${i * 90}ms` }}>
            <span className="signal__art"><ThermalIcon shape={shape} size={120} /></span>
            <figcaption>
              <span className="signal__t">{title}</span>
              <span className="signal__d">{text}</span>
            </figcaption>
          </figure>
        ))}
      </div>

      <ul className="sectors">
        {SECTORS.map(([name, text, shape], i) => (
          <li key={name} className="sector reveal" style={{ transitionDelay: `${(i % 2) * 60}ms` }}>
            <ThermalIcon shape={shape} size={52} />
            <span className="sector__main">
              <span className="sector__name">{name}</span>
              <span className="sector__text">{text}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="moments">
        <div className="moments__head reveal">
          <p className="eyebrow">Where we come in</p>
          <p className="moments__lead">Four moments where a few seconds of checking saves the most.</p>
        </div>
        <div className="moments__grid">
          {MOMENTS.map(([title, text], i) => (
            <Link key={title} href="/signup" className="moment reveal" style={{ transitionDelay: `${i * 70}ms` }}>
              <span className="moment__n">{String(i + 1).padStart(2, '0')}</span>
              <span className="moment__open">Start ↗</span>
              <p className="moment__p">
                <b>{title}.</b> {text}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
