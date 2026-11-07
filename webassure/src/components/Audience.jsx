'use client'

import Link from 'next/link'
import ScrollText from './ScrollText.jsx'
import AsciiArt from './AsciiArt.jsx'

const SIGNALS = [
  ['redirect', '#ff3d8b', 'Redirect chains', 'Every hop followed to where the link really ends.'],
  ['spark', '#ff7a1a', 'Impersonation', 'Look-alike brands flagged before you type a password.'],
  ['check', '#2ee6a6', 'Verified originals', 'The real site confirmed, certificate and all.'],
]

const SECTORS = [
  ['Banking & fintech', 'Net-banking logins, KYC forms, UPI collect requests', ['KYC update', 'OTP'], 'bank', '#2cc5f9'],
  ['Universities', 'Admission portals, fee-payment pages', ['Seat confirmation', 'Late fee'], 'cap', '#ff3d8b'],
  ['Recruitment', 'Career pages, offer letters, onboarding forms', ['Registration fee'], 'briefcase', '#ff7a1a'],
  ['E-commerce', 'Store fronts, refund and delivery pages', ['Refund', 'Re-delivery'], 'cart', '#2ee6a6'],
  ['Government services', 'Tax, ID and benefits portals', ['PAN / Aadhaar update'], 'dome', '#2cc5f9'],
  ['Payments', 'Payment links, QR codes, invoices', ['Pay to receive'], 'card', '#ff3d8b'],
  ['Healthcare', 'Pharmacies, insurance claim pages', ['Claim approval'], 'plus', '#ff7a1a'],
  ['Enterprise IT', 'SSO, mail and VPN sign-in pages', ['Password expiry', 'MFA reset'], 'server', '#2ee6a6'],
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
        {SIGNALS.map(([shape, color, title, text], i) => (
          <figure key={shape} className="signal reveal" style={{ transitionDelay: `${i * 90}ms` }}>
            <div className="signal__art">
              <AsciiArt shape={shape} color={color} label={title} />
            </div>
            <figcaption>
              <span className="signal__t">{title}</span>
              <span className="signal__d">{text}</span>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="stable reveal" role="table" aria-label="Sectors WebAssure protects">
        <div className="stable__row stable__row--head" role="row">
          <span role="columnheader">Sector</span>
          <span role="columnheader">What gets faked</span>
          <span role="columnheader">Typical lure</span>
        </div>
        {SECTORS.map(([name, faked, lures, shape, color]) => (
          <div key={name} className="stable__row" role="row">
            <span className="stable__sector" role="cell">
              <span className="sector__icon">
                <AsciiArt shape={shape} color={color} cols={14} rows={8} size="5px" label="" />
              </span>
              <span className="stable__name">{name}</span>
            </span>
            <span className="stable__faked" role="cell">{faked}</span>
            <span className="stable__lures" role="cell">
              {lures.map((l) => <span key={l} className="lure">{l}</span>)}
            </span>
          </div>
        ))}
      </div>

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
