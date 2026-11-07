'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import ScrollText from './ScrollText.jsx'
import { AuditVisual, CertificateVisual, LedgerVisual, PhishingVisual } from './Visuals.jsx'

const ITEMS = [
  {
    name: 'Phishing detection',
    line: 'AI compares a page with the brand it claims to be: the URL, the content and the layout, pixel by pixel.',
    Visual: PhishingVisual,
  },
  {
    name: 'Certificate intelligence',
    line: 'Every TLS certificate is checked against public transparency logs, issuer trust and key strength.',
    Visual: CertificateVisual,
  },
  {
    name: 'Website security',
    line: 'Headers, exposed services, redirects and outdated software, graded and ranked by real-world risk.',
    Visual: AuditVisual,
  },
  {
    name: 'Threat ledger',
    line: 'Confirmed threats are anchored on-chain, so every report is public, permanent and community-verified.',
    Visual: LedgerVisual,
  },
]

const DURATION = 6500

export default function WhatWeDo() {
  const [open, setOpen] = useState(0)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [visible, setVisible] = useState(false)
  const ref = useRef(null)
  const start = useRef(0)
  const carried = useRef(0)

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.25 })
    if (ref.current) io.observe(ref.current)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    carried.current = 0
    setProgress(0)
  }, [open])

  useEffect(() => {
    if (paused || !visible) return
    start.current = performance.now() - carried.current * DURATION
    let raf
    const tick = (now) => {
      const p = Math.min(1, (now - start.current) / DURATION)
      carried.current = p
      setProgress(p)
      if (p >= 1) setOpen((o) => (o + 1) % ITEMS.length)
      else raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [open, paused, visible])

  return (
    <section className="section wrap wwd" id="product" ref={ref}>
      <div className="wwd__head">
        <p className="eyebrow">What we do</p>
        <ScrollText
          className="t-statement wwd__statement"
          lead="We check a website the way an expert would: its look, its certificate, its code and its history."
          rest="Scams succeed when one of those is fake, so WebAssure looks at all four together and tells you which one gave it away."
        />
      </div>

      <div className="wwd__body">
        <div className="wwd__left" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          <ol className="wwd__list">
            {ITEMS.map((item, i) => (
              <li key={item.name} className="wwd__item" data-open={open === i || undefined}>
                <button className="wwd__q" onClick={() => setOpen(i)} aria-expanded={open === i}>
                  <span className="wwd__num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="wwd__name">{item.name}</span>
                </button>
                <div className="wwd__a">
                  <div className="wwd__inner">
                    <p>{item.line}</p>
                    <span className="wwd__track">
                      <span className="wwd__bar" style={{ transform: `scaleX(${open === i ? progress : 0})` }} />
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <div className="wwd__actions">
            <Link href="/signup" className="pill-btn">Start free</Link>
            <a href="#report" className="pill-btn">See a sample report</a>
          </div>
        </div>

        <div className="wwd__panel" aria-hidden="true">
          {ITEMS.map(({ name, Visual }, i) => (
            <div key={name} className="wwd__visual" data-on={open === i || undefined}>
              <Visual />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
