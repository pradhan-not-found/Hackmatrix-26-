'use client'

import { useEffect, useRef } from 'react'

// Pump tubes for the inflated hero wordmark: a glossy plastic tube runs in
// from each screen edge and plugs into the first letter (w) and the last
// letter (e) through a cone-shaped nozzle. Bubbles of air travel along the
// tubes into the letters. Same blue plastic as the wordmark, drawn on a
// full-width canvas behind it.

export default function HeroWires() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const host = canvas?.parentElement
    const svg = host?.querySelector('svg.thermal')
    if (!canvas || !svg) return
    const ctx = canvas.getContext('2d')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let W = 0, H = 0, R = 7 // tube radius (px), scaled to the letters
    let ends = []
    let bubbles = []
    let raf = 0, visible = true, last = performance.now(), nextBubble = 0

    const measure = () => {
      const cb = canvas.getBoundingClientRect()
      if (!cb.width) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      W = cb.width; H = cb.height
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const text = svg.querySelector('.thermal__glass text') || svg.querySelector('text')
      const n = text?.getNumberOfChars?.() || 0
      const m = svg.getScreenCTM()
      if (!n || !m) return
      const pt = svg.createSVGPoint()
      const toCanvas = (ux, uy) => { pt.x = ux; pt.y = uy; const p = pt.matrixTransform(m); return [p.x - cb.left, p.y - cb.top] }
      const first = text.getExtentOfChar(0)
      const lastC = text.getExtentOfChar(n - 1)
      const midY = 150 - 40
      const [lx, ly] = toCanvas(first.x + 10, midY)
      const [rx, ry] = toCanvas(lastC.x + lastC.width - 16, midY)
      R = Math.max(4, Math.min(11, 86 * m.a * 0.075))
      ends = [
        { side: -1, sx: -R * 2, sy: ly + H * 0.1, ex: lx, ey: ly },
        { side: 1, sx: W + R * 2, sy: ry + H * 0.1, ex: rx, ey: ry },
      ]
    }

    // Point on the tube at s (0 = screen edge, 1 = nozzle base), with a slow sway.
    const nozzleLen = () => R * 4.2
    const at = (e, s, t) => {
      const ex = e.ex - e.side * nozzleLen()
      const x = e.sx + (ex - e.sx) * s
      const sag = Math.sin(s * Math.PI) * (R * 2.4 + Math.sin(t * 0.0007 + e.side) * R * 0.8)
      return [x, e.sy + (e.ey - e.sy) * s + sag]
    }

    const path = (e, t, from = 0, to = 1) => {
      ctx.beginPath()
      for (let s = from; s <= to + 1e-4; s += 0.01) {
        const [x, y] = at(e, s, t)
        s === from ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
    }

    // A plastic tube: dark rim, body colour, then a soft highlight and a sharp
    // specular line offset toward the top, like the lit letters.
    const tube = (e, t, pal) => {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.save(); ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'; ctx.shadowBlur = R * 1.6; ctx.shadowOffsetY = R * 0.6
      path(e, t); ctx.strokeStyle = pal.rim; ctx.lineWidth = R * 2; ctx.stroke(); ctx.restore()
      path(e, t); ctx.strokeStyle = pal.body; ctx.lineWidth = R * 1.55; ctx.stroke()
      ctx.save(); ctx.translate(0, -R * 0.28)
      path(e, t); ctx.strokeStyle = pal.light; ctx.lineWidth = R * 0.9; ctx.stroke()
      ctx.translate(0, -R * 0.22)
      path(e, t); ctx.strokeStyle = pal.spec; ctx.lineWidth = Math.max(1, R * 0.22); ctx.stroke()
      ctx.restore()
    }

    // Collar where the tube meets the nozzle.
    const collar = (x, y, pal) => {
      const g = ctx.createLinearGradient(x, y - R * 1.3, x, y + R * 1.3)
      g.addColorStop(0, pal.spec); g.addColorStop(0.35, pal.light); g.addColorStop(0.7, pal.body); g.addColorStop(1, pal.rim)
      ctx.fillStyle = g
      ctx.beginPath(); ctx.roundRect(x - R * 0.7, y - R * 1.3, R * 1.4, R * 2.6, R * 0.5); ctx.fill()
    }

    // Cone nozzle pointing into the letter.
    const nozzle = (e, t, pal) => {
      const [bx, by] = at(e, 1, t)
      const g = ctx.createLinearGradient(bx, by - R * 1.2, bx, by + R * 1.2)
      g.addColorStop(0, pal.spec); g.addColorStop(0.3, pal.light); g.addColorStop(0.65, pal.body); g.addColorStop(1, pal.rim)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(bx, by - R * 1.1); ctx.lineTo(e.ex, e.ey - R * 0.35); ctx.lineTo(e.ex, e.ey + R * 0.35); ctx.lineTo(bx, by + R * 1.1)
      ctx.closePath(); ctx.fill()
      collar(bx, by, pal)
    }

    const draw = (t, dt) => {
      ctx.clearRect(0, 0, W, H)
      if (!ends.length) return
      const dark = document.documentElement.dataset.theme === 'dark'
      const pal = dark
        ? { rim: '#1c34a8', body: '#3d63f2', light: 'rgba(130, 165, 255, 0.95)', spec: 'rgba(235, 242, 255, 0.9)' }
        : { rim: '#2441c9', body: '#4672ff', light: 'rgba(150, 182, 255, 0.95)', spec: 'rgba(255, 255, 255, 0.95)' }

      for (const e of ends) { tube(e, t, pal); nozzle(e, t, pal) }

      // Air bubbles: a brighter bulge moving along the tube toward the letter.
      if (!reduce && t > nextBubble) {
        ends.forEach((_, k) => bubbles.push({ k, s: 0, v: 0.00035 + Math.random() * 0.00015 }))
        nextBubble = t + 1800 + Math.random() * 1000
      }
      bubbles = bubbles.filter((b) => (b.s += b.v * dt) < 1)
      for (const b of bubbles) {
        const e = ends[b.k]
        const [x, y] = at(e, b.s, t)
        const fade = Math.sin(b.s * Math.PI)
        const g = ctx.createRadialGradient(x, y - R * 0.45, R * 0.1, x, y, R * 1.25)
        g.addColorStop(0, `rgba(255, 255, 255, ${0.9 * fade})`)
        g.addColorStop(0.45, `rgba(170, 196, 255, ${0.7 * fade})`)
        g.addColorStop(1, 'rgba(70, 114, 255, 0)')
        ctx.fillStyle = g
        ctx.beginPath(); ctx.ellipse(x, y, R * 1.6, R * 1.2, 0, 0, Math.PI * 2); ctx.fill()
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
