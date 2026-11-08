'use client'

import { useEffect, useRef } from 'react'

// Pump tubes for the inflated hero wordmark: three glossy plastic tubes run in
// from each screen edge and plugs into the first letter (w) and the last
// letter (e) through a triangular plastic connector. Bubbles of air travel along the
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
      R = Math.max(5, Math.min(12, 86 * m.a * 0.085))
      ends = [
        { side: -1, sx: -R * 2, sy: ly + H * 0.1, ex: lx, ey: ly },
        { side: 1, sx: W + R * 2, sy: ry + H * 0.1, ex: rx, ey: ry },
      ]
    }

    // Three tubes per side, side by side, running into a triangular connector.
    const LANES = [-1, 0, 1]
    const r = () => R * 0.6 // radius of each tube
    const gap = () => r() * 2.25 // centre-to-centre spacing
    const connLen = () => R * 5

    // Point on lane `lane` at s (0 = screen edge, 1 = connector base), with a slow sway.
    const at = (e, s, t, lane = 0) => {
      const ex = e.ex - e.side * connLen()
      const x = e.sx + (ex - e.sx) * s
      const sway = Math.sin(t * 0.0007 + e.side + lane * 0.6) * R * 0.5
      const sag = Math.sin(s * Math.PI) * (R * 2.6 + sway)
      return [x, e.sy + (e.ey - e.sy) * s + sag + lane * gap()]
    }

    const path = (e, t, lane) => {
      ctx.beginPath()
      for (let s = 0; s <= 1.0001; s += 0.01) {
        const [x, y] = at(e, s, t, lane)
        s === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
    }

    // A glossy plastic tube: dark rim, body colour, soft highlight, sharp specular line.
    const tube = (e, t, lane, pal) => {
      const rr = r()
      ctx.lineCap = 'butt'; ctx.lineJoin = 'round'
      ctx.save(); ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'; ctx.shadowBlur = rr * 2; ctx.shadowOffsetY = rr * 0.7
      path(e, t, lane); ctx.strokeStyle = pal.rim; ctx.lineWidth = rr * 2; ctx.stroke(); ctx.restore()
      path(e, t, lane); ctx.strokeStyle = pal.body; ctx.lineWidth = rr * 1.5; ctx.stroke()
      ctx.save(); ctx.translate(0, -rr * 0.3)
      path(e, t, lane); ctx.strokeStyle = pal.light; ctx.lineWidth = rr * 0.85; ctx.stroke()
      ctx.translate(0, -rr * 0.25)
      path(e, t, lane); ctx.strokeStyle = pal.spec; ctx.lineWidth = Math.max(0.8, rr * 0.24); ctx.stroke()
      ctx.restore()
    }

    // Plastic gradient running top (lit) to bottom (shadow) across a shape.
    const shade = (y0, y1, pal) => {
      const g = ctx.createLinearGradient(0, y0, 0, y1)
      g.addColorStop(0, pal.spec); g.addColorStop(0.22, pal.light); g.addColorStop(0.6, pal.body); g.addColorStop(1, pal.rim)
      return g
    }

    // Triangular connector: wide base takes the three tubes, the tip plugs into the letter.
    const connector = (e, t, pal) => {
      const [bx, by] = at(e, 1, t, 0)
      const half = gap() + r() * 1.5
      const tipX = e.ex, tipY = e.ey
      const back = bx - e.side * r() * 0.8 // base sits a little over the tube ends
      ctx.save()
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)'; ctx.shadowBlur = R * 1.4; ctx.shadowOffsetY = R * 0.5
      ctx.beginPath()
      ctx.moveTo(back, by - half)
      ctx.lineTo(tipX, tipY - r() * 0.45)
      ctx.quadraticCurveTo(tipX + e.side * r() * 0.5, tipY, tipX, tipY + r() * 0.45)
      ctx.lineTo(back, by + half)
      ctx.closePath()
      ctx.fillStyle = shade(by - half, by + half, pal); ctx.fill()
      ctx.restore()
      // highlight along the upper edge
      ctx.beginPath(); ctx.moveTo(back, by - half + 1.5); ctx.lineTo(tipX - e.side * 2, tipY - r() * 0.3)
      ctx.strokeStyle = pal.spec; ctx.lineWidth = 1.2; ctx.stroke()
      // collar band across the base
      const cw = r() * 1.3
      const cx = back - e.side * cw * 0.5
      ctx.fillStyle = shade(by - half - 2, by + half + 2, pal)
      ctx.beginPath(); ctx.roundRect(cx - cw / 2, by - half - 2, cw, half * 2 + 4, cw * 0.4); ctx.fill()
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(cx - cw / 2 + 1.5, by - half); ctx.lineTo(cx - cw / 2 + 1.5, by + half); ctx.stroke()
    }

    const draw = (t, dt) => {
      ctx.clearRect(0, 0, W, H)
      if (!ends.length) return
      const dark = document.documentElement.dataset.theme === 'dark'
      const pal = dark
        ? { rim: '#1c34a8', body: '#3d63f2', light: 'rgba(130, 165, 255, 0.95)', spec: 'rgba(235, 242, 255, 0.92)' }
        : { rim: '#2441c9', body: '#4672ff', light: 'rgba(150, 182, 255, 0.95)', spec: 'rgba(255, 255, 255, 0.95)' }

      for (const e of ends) {
        for (const lane of LANES) tube(e, t, lane, pal)
        connector(e, t, pal)
      }

      // Air bubbles moving along each tube toward the letter, staggered per lane.
      if (!reduce && t > nextBubble) {
        ends.forEach((_, k) => LANES.forEach((lane, i) => bubbles.push({ k, lane, s: -i * 0.08, v: 0.00034 + Math.random() * 0.0001 })))
        nextBubble = t + 2000 + Math.random() * 900
      }
      bubbles = bubbles.filter((b) => (b.s += b.v * dt) < 1)
      for (const b of bubbles) {
        if (b.s <= 0) continue
        const e = ends[b.k]
        const [x, y] = at(e, b.s, t, b.lane)
        const fade = Math.sin(b.s * Math.PI)
        const rr = r()
        const g = ctx.createRadialGradient(x, y - rr * 0.4, rr * 0.1, x, y, rr * 1.3)
        g.addColorStop(0, `rgba(255, 255, 255, ${0.95 * fade})`)
        g.addColorStop(0.5, `rgba(170, 196, 255, ${0.6 * fade})`)
        g.addColorStop(1, 'rgba(70, 114, 255, 0)')
        ctx.fillStyle = g
        ctx.beginPath(); ctx.ellipse(x, y, rr * 1.7, rr * 1.15, 0, 0, Math.PI * 2); ctx.fill()
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
