'use client'

import { useEffect, useRef } from 'react'

// Pump tubes for the inflated hero wordmark: three glossy plastic tubes hang
// in from each screen edge and plug into the first letter (w) and the last
// letter (e) at its top, middle and bottom through small triangular tips. Bubbles of air travel along the
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
      R = Math.max(5, Math.min(12, 86 * m.a * 0.085))
      // Three plug points per letter: top, middle and bottom of the x-height.
      const rows = [150 - 74, 150 - 43, 150 - 12]
      const wIn = [0.04, 0.1, 0.17] // the w's outer edge slants inward toward the bottom
      const eIn = [0.14, 0.04, 0.12] // the e's right edge is round
      ends = []
      rows.forEach((uy, lane) => {
        const [lx, ly] = toCanvas(first.x + first.width * wIn[lane] + 4, uy)
        const [rx, ry] = toCanvas(lastC.x + lastC.width * (1 - eIn[lane]) - 12, uy)
        const drop = H * 0.02 + lane * R * 1.6 // start lower at the screen edge, spaced apart
        ends.push({ side: -1, lane, sx: -R * 2, sy: ly + drop, ex: lx, ey: ly })
        ends.push({ side: 1, lane, sx: W + R * 2, sy: ry + drop, ex: rx, ey: ry })
      })
    }

    // Each tube hangs in a still curve that sags most at the centre; lower
    // tubes sag a little more so the three never cross.
    const r = () => R * 0.6 // tube radius
    const tipLen = () => R * 2.6

    const at = (e, s) => {
      const ex = e.ex - e.side * tipLen()
      const x = e.sx + (ex - e.sx) * s
      const sag = Math.sin(s * Math.PI) * (H * 0.045 + e.lane * R * 1.1)
      return [x, e.sy + (e.ey - e.sy) * s + sag]
    }

    const path = (e) => {
      ctx.beginPath()
      for (let s = 0; s <= 1.0001; s += 0.01) {
        const [x, y] = at(e, s)
        s === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
    }

    // A glossy plastic tube: dark rim, body colour, soft highlight, sharp specular line.
    const tube = (e, pal) => {
      const rr = r()
      ctx.lineCap = 'butt'; ctx.lineJoin = 'round'
      ctx.save(); ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'; ctx.shadowBlur = rr * 2; ctx.shadowOffsetY = rr * 0.7
      path(e); ctx.strokeStyle = pal.rim; ctx.lineWidth = rr * 2; ctx.stroke(); ctx.restore()
      path(e); ctx.strokeStyle = pal.body; ctx.lineWidth = rr * 1.5; ctx.stroke()
      ctx.save(); ctx.translate(0, -rr * 0.3)
      path(e); ctx.strokeStyle = pal.light; ctx.lineWidth = rr * 0.85; ctx.stroke()
      ctx.translate(0, -rr * 0.25)
      path(e); ctx.strokeStyle = pal.spec; ctx.lineWidth = Math.max(0.8, rr * 0.24); ctx.stroke()
      ctx.restore()
    }

    // Plastic gradient running top (lit) to bottom (shadow) across a shape.
    const shade = (y0, y1, pal) => {
      const g = ctx.createLinearGradient(0, y0, 0, y1)
      g.addColorStop(0, pal.spec); g.addColorStop(0.22, pal.light); g.addColorStop(0.6, pal.body); g.addColorStop(1, pal.rim)
      return g
    }

    // Small triangular plastic tip where each tube plugs into the letter.
    const tip = (e, pal) => {
      const [bx, by] = at(e, 1)
      const half = r() * 1.35
      ctx.save()
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)'; ctx.shadowBlur = R; ctx.shadowOffsetY = R * 0.4
      ctx.beginPath()
      ctx.moveTo(bx, by - half)
      ctx.lineTo(e.ex, e.ey - r() * 0.3)
      ctx.lineTo(e.ex, e.ey + r() * 0.3)
      ctx.lineTo(bx, by + half)
      ctx.closePath()
      ctx.fillStyle = shade(by - half, by + half, pal); ctx.fill()
      ctx.restore()
      ctx.beginPath(); ctx.moveTo(bx, by - half + 1.2); ctx.lineTo(e.ex - e.side * 2, e.ey - r() * 0.25)
      ctx.strokeStyle = pal.spec; ctx.lineWidth = 1; ctx.stroke()
      // collar
      const cw = r() * 1.1
      ctx.fillStyle = shade(by - half - 1.5, by + half + 1.5, pal)
      ctx.beginPath(); ctx.roundRect(bx - e.side * cw * 0.2 - cw / 2, by - half - 1.5, cw, half * 2 + 3, cw * 0.4); ctx.fill()
    }

    const draw = (t, dt) => {
      ctx.clearRect(0, 0, W, H)
      if (!ends.length) return
      const dark = document.documentElement.dataset.theme === 'dark'
      const pal = dark
        ? { rim: '#1c34a8', body: '#3d63f2', light: 'rgba(130, 165, 255, 0.95)', spec: 'rgba(235, 242, 255, 0.92)' }
        : { rim: '#2441c9', body: '#4672ff', light: 'rgba(150, 182, 255, 0.95)', spec: 'rgba(255, 255, 255, 0.95)' }

      for (const e of ends) { tube(e, pal); tip(e, pal) }

      // Air bubbles moving along each tube toward the letter, staggered per lane.
      if (!reduce && t > nextBubble) {
        ends.forEach((e, k) => bubbles.push({ k, s: -e.lane * 0.08, v: 0.00034 + Math.random() * 0.0001 }))
        nextBubble = t + 2000 + Math.random() * 900
      }
      bubbles = bubbles.filter((b) => (b.s += b.v * dt) < 1)
      for (const b of bubbles) {
        if (b.s <= 0) continue
        const e = ends[b.k]
        const [x, y] = at(e, b.s)
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
