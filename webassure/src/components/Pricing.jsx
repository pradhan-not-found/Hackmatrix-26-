'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckIcon } from './Icons.jsx'
import ThermalIcon from './ThermalIcon.jsx'

const PLANS = [
  {
    name: 'Personal',
    icon: 'check',
    monthly: 0,
    blurb: 'Check links before you trust them.',
    cta: 'Start free',
    lead: 'Includes',
    features: ['50 checks a month', 'Phishing and scam detection', 'Plain-language risk reports', 'Browser link checker'],
  },
  {
    name: 'Pro',
    icon: 'spark',
    monthly: 499,
    blurb: 'For professionals and small businesses.',
    cta: 'Start 14-day trial',
    featured: true,
    lead: 'Everything in Personal, plus',
    features: ['Unlimited checks', 'Certificate monitoring for 10 domains', 'Full evidence reports and export', 'Instant email alerts', 'Submit to the threat ledger'],
  },
  {
    name: 'Teams',
    icon: 'nodes',
    monthly: 2499,
    blurb: 'For security teams protecting a brand.',
    cta: 'Start 14-day trial',
    lead: 'Everything in Pro, plus',
    features: ['REST API and webhooks', 'Brand impersonation monitoring', 'Unlimited certificate monitoring', 'SSO and role-based access', 'Priority support'],
  },
]

const fmt = (n) => n.toLocaleString('en-IN')

export default function Pricing() {
  const [yearly, setYearly] = useState(true)

  return (
    <section className="section wrap" id="pricing">
      <div className="pricing__head">
        <div className="wwd__head">
          <p className="eyebrow">Pricing</p>
          <h2 className="t-statement wwd__statement">Free for individuals. Simple plans for everyone else.</h2>
        </div>
        <div className="billing" role="group" aria-label="Billing period">
          <button aria-pressed={!yearly} onClick={() => setYearly(false)}>Monthly</button>
          <button aria-pressed={yearly} onClick={() => setYearly(true)}>
            Yearly <span className="billing__save">−17%</span>
          </button>
        </div>
      </div>

      <div className="plans reveal">
        {PLANS.map((p) => {
          const price = yearly ? Math.round((p.monthly * 10) / 12) : p.monthly
          return (
            <article key={p.name} className="plan" data-featured={p.featured || undefined}>
              {p.featured && <span className="plan__glow" aria-hidden="true" />}
              <span className="plan__icon"><ThermalIcon shape={p.icon} size={64} /></span>
              <header className="plan__top">
                <h3 className="plan__name">{p.name}</h3>
                {p.featured && <span className="plan__tag">Most popular</span>}
              </header>
              <p className="plan__blurb">{p.blurb}</p>
              <div className="plan__price">
                <span className="plan__amt">{p.monthly === 0 ? '₹0' : `₹${fmt(price)}`}</span>
                <span className="plan__per">
                  {p.monthly === 0 ? 'Free forever' : <>per month{yearly && <><br />billed yearly</>}</>}
                </span>
              </div>
              <Link href="/signup" className={`btn btn--block ${p.featured ? 'btn--ink' : 'btn--ghost'}`}>{p.cta}</Link>
              <p className="plan__lead">{p.lead}</p>
              <ul className="plan__list">
                {p.features.map((f) => (
                  <li key={f}><CheckIcon />{f}</li>
                ))}
              </ul>
            </article>
          )
        })}
      </div>

      <div className="enterprise reveal">
        <div>
          <p className="enterprise__t">Enterprise</p>
          <p className="enterprise__d">Custom volumes, on-premise scanning, takedown support and a dedicated analyst.</p>
        </div>
        <a href="mailto:hello@webassure.dev" className="btn btn--ghost">Contact sales</a>
      </div>
      <p className="pricing__note">Prices in INR, excluding GST. Cancel any time.</p>
    </section>
  )
}
