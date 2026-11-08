'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { H, SLIDES, W } from '../lib/deck.mjs'
import { SHIELD, downloadPdf, downloadPptx } from '../lib/deck-export.js'
import '../styles/download.css'

const pct = (value, total) => `${(value / total) * 100}%`
const cq = (px) => `${px / 12.8}cqw`
const color = (hex) => `#${hex}`

function Text({ item }) {
  const parts = typeof item.value === 'string' ? [{ t: item.value }] : item.value
  return (
    <p
      className={`dl-el${item.font === 'brand' ? ' dl-el--brand' : ''}`}
      style={{
        left: pct(item.x, W), top: pct(item.y, H), width: pct(item.w, W), minHeight: pct(item.h, H),
        fontSize: cq(item.size), lineHeight: item.lh, color: color(item.color), textAlign: item.align || 'left',
        fontWeight: item.weight || 400, letterSpacing: `${item.ls || 0}em`,
      }}
    >
      {parts.map((part, index) => (
        <span key={index} style={{ fontWeight: part.b ? 600 : undefined, color: part.c ? color(part.c) : undefined }}>{part.t}</span>
      ))}
    </p>
  )
}

function Lines({ items }) {
  if (!items.length) return null
  return (
    <svg className="dl-lines" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      {items.map((line, index) => {
        const angle = Math.atan2(line.y2 - line.y1, line.x2 - line.x1)
        const corner = (offset) => `${line.x2 - 9 * Math.cos(angle) + offset * Math.sin(angle)},${line.y2 - 9 * Math.sin(angle) - offset * Math.cos(angle)}`
        const head = `${corner(5)} ${corner(-5)} ${line.x2},${line.y2}`
        return (
          <g key={index}>
            <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke={color(line.color)} strokeWidth="1" />
            {!line.plain && <polygon points={head} fill={color(line.color)} />}
          </g>
        )
      })}
    </svg>
  )
}

function Item({ item }) {
  if (item.type === 'text') return <Text item={item} />
  if (item.type === 'rect') {
    return (
      <span
        className="dl-el"
        style={{
          left: pct(item.x, W), top: pct(item.y, H), width: pct(item.w, W), height: pct(item.h, H),
          background: color(item.fill), borderRadius: cq(item.radius),
          boxShadow: item.stroke ? `inset 0 0 0 1px ${color(item.stroke)}` : undefined,
        }}
      />
    )
  }
  if (item.type === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="dl-el dl-el--logo" src={item.src} alt={item.alt}
        style={{ left: pct(item.x, W), top: pct(item.y, H), width: pct(item.w, W), height: pct(item.h, H) }}
      />
    )
  }
  if (item.type === 'shield') {
    return (
      <svg className="dl-el" viewBox="6 8 52 48" style={{ left: pct(item.x, W), top: pct(item.y, H), width: pct(item.size, W) }} aria-hidden="true">
        <g fill="#f1f1f1" stroke="#f1f1f1" strokeWidth="3" strokeLinejoin="round">
          {SHIELD.map((d) => <path key={d} d={d} />)}
        </g>
      </svg>
    )
  }
  if (item.type === 'wordmark') {
    return (
      <p className="dl-el dl-el--brand dl-el--mark" style={{ left: pct(item.x, W), top: pct(item.y, H), fontSize: cq(item.size) }}>webassure</p>
    )
  }
  return null
}

function Slide({ page, innerRef }) {
  return (
    <div className="dl-slide" ref={innerRef}>
      {page.items.filter((item) => item.type === 'rect').map((item, index) => <Item key={index} item={item} />)}
      <Lines items={page.items.filter((item) => item.type === 'arrow')} />
      {page.items.filter((item) => item.type !== 'rect' && item.type !== 'arrow').map((item, index) => <Item key={index} item={item} />)}
    </div>
  )
}

export default function Download() {
  const slides = useRef([])
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')

  const run = async (kind) => {
    setBusy(kind)
    setError('')
    try {
      if (kind === 'pptx') await downloadPptx()
      else await downloadPdf(slides.current.filter(Boolean))
    } catch {
      setError('The download could not be created. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="dl">
      <header className="dl__bar">
        <Link href="/" className="wordmark" aria-label="WebAssure home">webassure</Link>
        <div className="dl__actions">
          <button type="button" className="btn btn--ghost" disabled={!!busy} onClick={() => run('pdf')}>
            {busy === 'pdf' ? 'Preparing PDF…' : 'Download PDF'}
          </button>
          <button type="button" className="btn btn--ink" disabled={!!busy} onClick={() => run('pptx')}>
            {busy === 'pptx' ? 'Preparing PPT…' : 'Download PPT'}
          </button>
        </div>
      </header>

      <main className="dl__main">
        <div className="dl__head">
          <p className="eyebrow">HackMatrix 2026</p>
          <h1 className="dl__title">Pitch deck</h1>
          <p className="dl__sub">{SLIDES.length} slides. Review them here, then download.</p>
          {error && <p className="dl__error" role="alert">{error}</p>}
        </div>

        <ol className="dl__list">
          {SLIDES.map((page, index) => (
            <li key={page.name} className="dl__item">
              <p className="dl__label"><span>{String(index + 1).padStart(2, '0')}</span>{page.name}</p>
              <Slide page={page} innerRef={(node) => { slides.current[index] = node }} />
            </li>
          ))}
        </ol>
      </main>
    </div>
  )
}
