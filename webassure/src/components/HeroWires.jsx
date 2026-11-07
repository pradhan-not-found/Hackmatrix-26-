'use client'

import { useEffect, useRef } from 'react'

// Pump lines for the inflated hero wordmark: a bundle of thin wires runs in
// from each screen edge and plugs into the first letter (w) and the last
// letter (e) through a small triangular nozzle. Pulses of "air" travel along
// the wires into the letters, and short pressure ticks flash at the nozzle
// as each pulse arrives. Drawn on a full-width canvas behind the wordmark.

const STRANDS = [-8, 0, 8] // vertical offsets of the wires in the bundle (px)

export default function HeroWires() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const host = canvas?.parentElement
    const svg = host?.querySelector('svg.thermal')
    if (!canvas || !svg) return
    const ctx = canvas.getContext('2d')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let W = 0, H = 0
    let ends = [] // [{ side, sx, sy, ex, ey }]
    let pulses = []
    let flash = [0, 0]
    let raf = 0, visible = true, last = performance.now(), nextPulse = 0

    const measure = () => {
      const cb = canvas.getBoundingClientRect()
      if (!cb.width) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      W = cb.width; H = cb.height
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Find the outer edges of the first and last letters in screen space.
      const text = svg.querySelector('.thermal__glass text') || svg.querySelector('text')
      const n = text?.getNumberOfChars?.() || 0
      const m = svg.getScreenCTM()
      if (!n || !m) return
      const pt = svg.createSVGPoint()
      const toCanvas = (ux, uy) => { pt.x = ux; pt.y = uy; const p = pt.matrixTransform(m); return [p.x - cb.left, p.y - cb.top] }
      const first = text.getExtentOfChar(0)
      const lastC = text.getExtentOfChar(n - 1)
      const midY = 150 - 43 // half the x-height above the baseline (user units)
      const [lx, ly] = toCanvas(first.x + 4, midY)
      const [rx, ry] = toCanvas(lastC.x + lastC.width - 10, midY)
      ends = [
        { side: -1, sx: 0, sy: ly + H * 0.08, ex: lx, ey: ly },
        { side: 1, sx: W, sy: ry + H * 0.08, ex: rx, ey: ry },
      ]
    }

    // Point on a wire at s (0 = screen edge, 1 = nozzle), with a slow sway.
    const at = (e, off, s, t) => {
      const nozzle = 34 // wire stops where the nozzle starts
      const ex = e.ex - e.side * nozzle
      const x = e.sx + (ex - e.sx) * s
      const sag = Math.sin(s * Math.PI) * (14 + Math.sin(t * 0.0007 + e.side) * 6)
      const y = e.sy + (e.ey - e.sy) * s + sag + off * (1 - s * 0.55)
      return [x, y]
    }

    const draw = (t, dt) => {
      ctx.clearRect(0, 0, W, H)
      if (!ends.length) return
      const dark = document.documentElement.dataset.theme === 'dark'
      const ink = dark ? '130, 165, 255' : '52, 97, 240'

      ends.forEach((e, k) => {
        // wire bundle
        STRANDS.forEach((off, i) => {
          ctx.beginPath()
          for (let s = 0; s <= 1.0001; s += 0.02) {
            const [x, y] = at(e, off, s, t + i * 400)
            s === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
          }
          ctx.strokeStyle = `rgba(${ink}, ${i === 1 ? 0.85 : 0.5})`
          ctx.lineWidth = i === 1 ? 1.8 : 1.2
          ctx.stroke()
        })

        // clamps along the bundle
        for (const s of [0.35, 0.62, 0.84]) {
          const [x1, y1] = at(e, STRANDS[0] - 4, s, t)
          const [x2, y2] = at(e, STRANDS[2] + 4, s, t)
          ctx.strokeStyle = `rgba(${ink}, 0.7)`; ctx.lineWidth = 1.4
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
        }

        // triangular nozzle pointing into the letter
        const [bx, by] = at(e, 0, 1, t)
        const tipX = e.ex, tipY = e.ey
        ctx.beginPath()
        ctx.moveTo(bx, by - 12); ctx.lineTo(bx, by + 12); ctx.lineTo(tipX, tipY); ctx.closePath()
        ctx.fillStyle = `rgba(${ink}, ${dark ? 0.35 : 0.22})`; ctx.fill()
        ctx.strokeStyle = `rgba(${ink}, 0.95)`; ctx.lineWidth = 1.5; ctx.stroke()

        // pressure ticks that flash when a pulse arrives
        const f = flash[k]
        if (f > 0) {
          // short lines fanning out above and below the nozzle, pointing away from the letter
          const away = e.side < 0 ? Math.PI : 0
          const cx = tipX + e.side * 10, cy = tipY
          for (const a of [-1.35, -0.85, 0.85, 1.35]) {
            const ang = away + a * (e.side < 0 ? 1 : -1)
            const r1 = 16, r2 = 16 + 9 * (1 - f) + 4
            ctx.beginPath()
            ctx.moveTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1)
            ctx.lineTo(cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2)
            ctx.strokeStyle = `rgba(${ink}, ${0.9 * f})`; ctx.lineWidth = 1.5; ctx.stroke()
          }
          flash[k] = Math.max(0, f - dt * 0.0025)
        }
      })

      // air pulses flowing toward the letters
      if (!reduce && t > nextPulse) {
        ends.forEach((_, k) => pulses.push({ k, s: 0, strand: Math.floor(Math.random() * STRANDS.length), v: 0.00045 + Math.random() * 0.0002 }))
        nextPulse = t + 1400 + Math.random() * 900
      }
      pulses = pulses.filter((p) => {
        p.s += p.v * dt
        if (p.s >= 1) { flash[p.k] = 1; return false }
        return true
      })
      for (const p of pulses) {
        const e = ends[p.k]
        const [x, y] = at(e, STRANDS[p.strand], p.s, t)
        const [x0, y0] = at(e, STRANDS[p.strand], Math.max(0, p.s - 0.06), t)
        const g = ctx.createLinearGradient(x0, y0, x, y)
        g.addColorStop(0, `rgba(${ink}, 0)`); g.addColorStop(1, dark ? 'rgba(200, 220, 255, 0.95)' : 'rgba(52, 97, 240, 0.95)')
        ctx.strokeStyle = g; ctx.lineWidth = 2.6; ctx.lineCap = 'round'
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x, y); ctx.stroke()
        ctx.lineCap = 'butt'
      }
    }

    const loop = (t) => {
      const dt = Math.min(48, t - last); last = t
      draw(t, dt)
      if (visible && !reduce) raf = requestAnimationFrame(loop)
    }
    const start = () => { cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(loop) }

    const ready = document.fonts?.ready || Promise.resolve()
    ready.then(() => { measure(); start() })

    const remeasure = () => { measure(); if (reduce) draw(0, 0) }
    const ro = new ResizeObserver(remeasure)
    ro.observe(svg)
    window.addEventListener('resize', remeasure)
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting && !document.hidden; if (visible) start() })
    io.observe(canvas)
    const onVis = () => { visible = !document.hidden; if (visible) start() }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect()
      window.removeEventListener('resize', remeasure)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return <canvas ref={canvasRef} className="hero__wires" aria-hidden="true" />
}
