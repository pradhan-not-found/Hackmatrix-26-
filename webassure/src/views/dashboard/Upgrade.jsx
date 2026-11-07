'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useDash } from './context.js'
import { usePlan } from './usePlan.js'
import { ORDER, PLANS, chargeFor, inr, priceFor, setPlan } from '../../lib/plan.js'
import MockQR from '../../components/MockQR.jsx'

const Check = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
)

function Checkout({ planId, cycle, user, onClose }) {
  const router = useRouter()
  const plan = PLANS[planId]
  const total = chargeFor(plan, cycle)
  const gst = Math.round(total * 0.18)
  const [step, setStep] = useState('pay') // pay → verifying → done
  const ref = `WA${Date.now().toString(36).toUpperCase().slice(-6)}`

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && step !== 'verifying' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, step])

  const confirm = () => {
    setStep('verifying')
    setTimeout(() => {
      setPlan(user.id, planId, cycle)
      setStep('done')
    }, 1800)
  }

  return (
    <div className="ck" role="dialog" aria-modal="true" aria-label={`Upgrade to ${plan.name}`}>
      <button className="ck__scrim" onClick={() => step !== 'verifying' && onClose()} aria-label="Close checkout" />
      <div className="ck__panel">
        {step === 'done' ? (
          <div className="ck__done">
            <span className="ck__ok"><Check /></span>
            <h2>You&apos;re on {plan.name}</h2>
            <p>Payment confirmed. Your new limits are active now and your plan renews {cycle === 'yearly' ? 'in a year' : 'next month'}.</p>
            <div className="ck__done-btns">
              <button className="btn btn--soft" onClick={() => router.push('/dashboard/settings#plan')}>View billing</button>
              <button className="btn btn--ink" onClick={() => router.push('/dashboard')}>Go to dashboard</button>
            </div>
          </div>
        ) : (
          <>
            <div className="ck__head">
              <div>
                <p className="ck__k">Checkout</p>
                <h2>Upgrade to {plan.name}</h2>
              </div>
              <button className="icon-btn" onClick={onClose} disabled={step === 'verifying'} aria-label="Close">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
              </button>
            </div>

            <div className="ck__body">
              <div className="ck__qr">
                <MockQR seed={`${planId}-${cycle}-${user.id}`} size={196} />
                <p className="ck__scan">Scan with any UPI app</p>
                <p className="ck__apps">GPay · PhonePe · Paytm · BHIM</p>
              </div>

              <div className="ck__sum">
                <dl>
                  <div><dt>{plan.name} · {cycle === 'yearly' ? 'Yearly' : 'Monthly'}</dt><dd>{inr(total)}</dd></div>
                  <div><dt>GST (18%)</dt><dd>{inr(gst)}</dd></div>
                  <div className="ck__total"><dt>Total due today</dt><dd>{inr(total + gst)}</dd></div>
                </dl>
                <div className="ck__meta">
                  <p><span>Pay to</span>webassure@upi</p>
                  <p><span>Reference</span>{ref}</p>
                  <p><span>Account</span>{user.email}</p>
                </div>
                <button className="btn btn--ink btn--block ck__pay" onClick={confirm} disabled={step === 'verifying'}>
                  {step === 'verifying' ? <><span className="ck__spin" aria-hidden="true" />Verifying payment…</> : `I've paid ${inr(total + gst)}`}
                </button>
                <p className="ck__demo">Demo checkout: no money is charged and this QR code is not a real payment address.</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function Upgrade() {
  const { user } = useDash()
  const current = usePlan(user.id)
  const [cycle, setCycle] = useState('yearly')
  const [checkout, setCheckout] = useState(null)

  return (
    <>
      <div className="up__head">
        <Link href="/dashboard/settings#plan" className="up__back">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          Back to billing
        </Link>
        <h1 className="dash__title up__title">Choose your plan</h1>
        <p className="up__sub">Upgrade any time. Prices in INR, excluding GST.</p>
        <div className="billing up__cycle" role="group" aria-label="Billing period">
          <button aria-pressed={cycle === 'monthly'} onClick={() => setCycle('monthly')}>Monthly</button>
          <button aria-pressed={cycle === 'yearly'} onClick={() => setCycle('yearly')}>Yearly <span className="billing__save">2 months free</span></button>
        </div>
      </div>

      <div className="up__grid">
        {ORDER.map((id) => {
          const p = PLANS[id]
          const isCurrent = current.id === id
          const rank = ORDER.indexOf(id) - ORDER.indexOf(current.id)
          return (
            <article key={id} className="up__card" data-popular={p.popular || undefined} data-current={isCurrent || undefined}>
              <div className="up__top">
                <h2>{p.name}</h2>
                {isCurrent ? <span className="up__tag up__tag--cur">Current plan</span>
                  : p.popular ? <span className="up__tag">Most popular</span>
                  : <span className="up__tag up__tag--ghost" aria-hidden="true">Plan</span>}
              </div>
              <p className="up__blurb">{p.blurb}</p>
              <div className="up__price">
                <p className="up__amt">{inr(priceFor(p, cycle))}<span>/ month</span></p>
                <p className="up__note">
                  {!p.monthly ? 'Free forever, no card needed'
                    : cycle === 'yearly' ? `${inr(chargeFor(p, cycle))} billed yearly`
                    : 'Billed monthly'}
                </p>
              </div>
              {isCurrent ? (
                <button className="btn btn--block up__btn up__btn--cur" disabled><Check />Your current plan</button>
              ) : rank > 0 ? (
                <button className={`btn btn--block up__btn ${p.popular ? 'btn--ink' : 'up__btn--sec'}`} onClick={() => setCheckout(id)}>Upgrade to {p.name}</button>
              ) : (
                <button className="btn btn--block up__btn up__btn--sec" onClick={() => { setPlan(user.id, id, 'monthly') }}>Switch to {p.name}</button>
              )}
              <p className="up__inc">{id === 'personal' ? 'Includes' : id === 'pro' ? 'Everything in Personal, plus' : 'Everything in Pro, plus'}</p>
              <ul className="up__list">
                {p.features.filter((f) => f !== 'Everything in Pro').map((f) => <li key={f}><Check />{f}</li>)}
              </ul>
            </article>
          )
        })}
      </div>

      <p className="up__foot">Secure checkout · Cancel any time · Need more? <a href="mailto:hello@webassure.dev">Contact sales</a></p>

      {checkout && <Checkout planId={checkout} cycle={cycle} user={user} onClose={() => setCheckout(null)} />}
    </>
  )
}
