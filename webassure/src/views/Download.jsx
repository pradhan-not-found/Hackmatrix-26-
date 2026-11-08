'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { H, THEMES, W, buildSlides } from '../lib/deck.mjs'
import { SHIELD, downloadPdf, downloadPptx, wrapText } from '../lib/deck-export.js'
import '../styles/download.css'

const pct = (value, total) => `${(value / total) * 100}%`
const cq = (px) => `${px / 12.8}cqw`
const color = (hex) => `#${hex}`

function Text({ item, measured }) {
  const fallback = [(typeof item.value === 'string' ? [{ t: item.value }] : item.value).map((part) => ({
    text: part.t, bold: part.b || item.weight === 600, color: part.c || item.color,
  }))]
  const lines = measured ? wrapText(item) : fallback
  return (
    <div
      className={`dl-el${item.font === 'brand' ? ' dl-el--brand' : ''}`}
      style={{
        left: pct(item.x, W), top: pct(item.y, H), width: pct(item.w, W),
        fontSize: cq(item.size), lineHeight: item.lh, textAlign: item.align || 'left', letterSpacing: `${item.ls || 0}em`,
      }}
    >
      {lines.map((line, lineIndex) => (
        <span key={lineIndex} className={measured ? 'dl-line' : 'dl-line dl-line--wrap'}>
          {line.map((run, runIndex) => (
            <span key={runIndex} style={{ fontWeight: run.bold ? 600 : 400, color: color(run.color) }}>{run.text}</span>
          ))}
        </span>
      ))}
    </div>
  )
}

function Lines({ items }) {
  if (!items.length) return null
  return (
    <svg className="dl-lines" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      {items.map((line, index) => {
        const angle = Math.atan2(line.y2 - line.y1, line.x2 - line.x1)
        const corner = (offset) => `${line.x2 - 9 * Math.cos(angle) + offset * Math.sin(angle)},${line.y2 - 9 * Math.sin(angle) - offset * Math.cos(angle)}`
        return (
          <g key={index}>
            <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke={color(line.color)} strokeWidth="1" />
            <polygon points={`${corner(5)} ${corner(-5)} ${line.x2},${line.y2}`} fill={color(line.color)} />
          </g>
        )
      })}
    </svg>
  )
}

function Item({ item, measured }) {
  if (item.type === 'text') return <Text item={item} measured={measured} />
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
      <img className="dl-el dl-el--logo" src={item.src} alt={item.alt} style={{ left: pct(item.x, W), top: pct(item.y, H), width: pct(item.w, W), height: pct(item.h, H) }} />
    )
  }
  if (item.type === 'shield') {
    return (
      <svg className="dl-el" viewBox="6 8 52 48" style={{ left: pct(item.x, W), top: pct(item.y, H), width: pct(item.size, W) }} aria-hidden="true">
        <g fill={color(item.color)} stroke={color(item.color)} strokeWidth="3" strokeLinejoin="round">
          {SHIELD.map((d) => <path key={d} d={d} />)}
        </g>
      </svg>
    )
  }
  if (item.type === 'wordmark') {
    return (
      <p className="dl-el dl-el--brand dl-el--mark" style={{ left: pct(item.x, W), top: pct(item.y, H), fontSize: cq(item.size), color: color(item.color) }}>webassure</p>
    )
  }
  return null
}

function Slide({ page, background, innerRef, measured }) {
  const of = (test) => page.items.filter(test)
  return (
    <div className="dl-slide" ref={innerRef} style={{ background: color(background) }}>
      {of((item) => item.type === 'rect').map((item, index) => <Item key={index} item={item} />)}
      <Lines items={of((item) => item.type === 'arrow')} />
      {of((item) => item.type !== 'rect' && item.type !== 'arrow').map((item, index) => <Item key={index} item={item} measured={measured} />)}
    </div>
  )
}

export default function Download() {
  const nodes = useRef([])
  const [mode, setMode] = useState('dark')
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')
  const [measured, setMeasured] = useState(false)
  const slides = useMemo(() => buildSlides(mode), [mode])

  useEffect(() => {
    let active = true
    document.fonts.ready.then(() => { if (active) setMeasured(true) })
    return () => { active = false }
  }, [])

  const run = async (kind) => {
    setBusy(kind)
    setError('')
    try {
      if (kind === 'pptx') await downloadPptx(mode)
      else await downloadPdf(nodes.current.slice(0, slides.length).filter(Boolean), mode)
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
          <div className="dl__theme" role="group" aria-label="Slide background">
            {Object.entries(THEMES).map(([key, theme]) => (
              <button key={key} type="button" aria-pressed={mode === key} disabled={!!busy} onClick={() => setMode(key)}>
                <span className="dl__swatch" style={{ background: color(theme.bg) }} />
                {theme.label}
              </button>
            ))}
          </div>
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
          <p className="dl__sub">{slides.length} slides. Choose a background, review them here, then download.</p>
          {error && <p className="dl__error" role="alert">{error}</p>}
        </div>

        <ol className="dl__list">
          {slides.map((page, index) => (
            <li key={page.name} className="dl__item">
              <p className="dl__label"><span>{String(index + 1).padStart(2, '0')}</span>{page.name}</p>
              <Slide page={page} background={THEMES[mode].bg} measured={measured} innerRef={(node) => { nodes.current[index] = node }} />
            </li>
          ))}
        </ol>
      </main>
    </div>
  )
}
