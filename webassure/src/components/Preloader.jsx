'use client'

import { useEffect, useRef, useState } from 'react'

const PHRASES = ['Know your website', 'Trust every link', 'Click with confidence']

const CH = 0.03 // s between letters
const GAP = 0.18 // s pause between phrases
// Each phrase starts after the previous one has finished writing.
const STARTS = PHRASES.reduce((acc, p, i) => [...acc, i ? acc[i - 1] + PHRASES[i - 1].length * CH + GAP : 0.2], [])
const WRITTEN = (STARTS[STARTS.length - 1] + PHRASES[PHRASES.length - 1].length * CH + 0.5) * 1000
const HOLD = Math.round(WRITTEN + 450) // ms: all three written, then a short hold
const WORDS_OUT = 380 // ms: the phrases blur away first
const DISSOLVE = 1100 // ms: then the screen dissolves in random soft spots
const EXIT = WORDS_OUT + DISSOLVE

// Random soft-spot dissolve: many spots appear at random places and times,
// grow and merge until the screen is gone. Drawn on a canvas that is blurred,
// so the holes have soft, smoky edges rather than circles.
function dissolve(canvas, color) {
  const dpr = Math.min(1.5, window.devicePixelRatio || 1)
  const W = window.innerWidth, H = window.innerHeight
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const cell = Math.max(W, H) / 11
  const spots = []
  // jittered grid so spots cover the whole screen evenly but look random
  for (let y = -cell / 2; y < H + cell; y += cell * 0.8) {
    for (let x = -cell / 2; x < W + cell; x += cell * 0.8) {
      spots.push({
        x: x + (Math.random() - 0.5) * cell * 0.9,
        y: y + (Math.random() - 0.5) * cell * 0.9,
        start: Math.random() * 0.55, // when it begins (0..1 of the dissolve)
        r: cell * (0.75 + Math.random() * 0.6), // final radius
      })
    }
  }
  const ease = (t) => 1 - Math.pow(1 - t, 3)
  const t0 = performance.now()
  let raf = 0
  const frame = (now) => {
    const p = Math.min(1, (now - t0) / DISSOLVE)
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = color
    ctx.fillRect(0, 0, W, H)
    ctx.globalCompositeOperation = 'destination-out'
    for (const s of spots) {
      const k = (p - s.start) / (1 - s.start)
      if (k <= 0) continue
      const r = s.r * ease(Math.min(1, k * 1.25))
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r)
      g.addColorStop(0, 'rgba(0,0,0,1)')
      g.addColorStop(0.55, 'rgba(0,0,0,0.9)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(s.x - r, s.y - r, r * 2, r * 2)
    }
    if (p < 1) raf = requestAnimationFrame(frame)
    else ctx.clearRect(0, 0, W, H)
  }
  raf = requestAnimationFrame(frame)
  return () => cancelAnimationFrame(raf)
}

export default function Preloader({ onDone }) {
  const [leaving, setLeaving] = useState(false)
  const [dissolving, setDissolving] = useState(false)
  const canvasRef = useRef(null)
  const rootRef = useRef(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onDone()
      return
    }
    document.documentElement.style.overflow = 'hidden'
    const a = setTimeout(() => setLeaving(true), HOLD)
    const b = setTimeout(() => setDissolving(true), HOLD + WORDS_OUT)
    const c = setTimeout(() => {
      document.documentElement.style.overflow = ''
      onDone()
    }, HOLD + EXIT)
    return () => {
      clearTimeout(a); clearTimeout(b); clearTimeout(c)
      document.documentElement.style.overflow = ''
    }
  }, [onDone])

  useEffect(() => {
    if (!dissolving || !canvasRef.current) return
    const color = getComputedStyle(rootRef.current).backgroundColor || '#121212'
    return dissolve(canvasRef.current, color)
  }, [dissolving])

  return (
    <div ref={rootRef} className="preloader" data-leaving={leaving || undefined} data-dissolving={dissolving || undefined} aria-hidden="true">
      <div className="preloader__words">
        {PHRASES.map((p, i) => (
          <span key={p} className="preloader__phrase" aria-label={p}>
            {[...p].map((ch, j) => (
              <span key={j} className="preloader__ch" style={{ animationDelay: `${STARTS[i] + j * CH}s` }}>
                {ch === ' ' ? ' ' : ch}
              </span>
            ))}
          </span>
        ))}
      </div>
      <canvas ref={canvasRef} className="preloader__dissolve" />
    </div>
  )
}
