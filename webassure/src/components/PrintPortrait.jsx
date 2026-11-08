'use client'

import { useEffect, useRef, useState } from 'react'

// Print-style team portrait (same treatment as the Studio 1 team page): the
// exact photo in black and white, printed with a fine 45° dot screen and
// multiplied onto warm paper, so the white studio backdrop becomes the paper.
// On hover, small tiles around the cursor shift and jitter, then settle back.

const SCREEN = 3.2 // device px per halftone cell
const MIX = 0.5 // 0 = plain photo, 1 = pure halftone
const TILE = 4 // css px per moving block
const RADIUS = 70 // css px around the cursor that reacts
const PUSH = 4 // css px, largest push

const noise = (i, j) => { const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return n - Math.floor(n) }

export default function PrintPortrait({ src, alt, zoom = 1, pos = 'center 22%', origin = 0.3, bright = 1 }) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    const ctx = canvas.getContext('2d')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const s = { img: null, art: null, w: 0, h: 0, dpr: 1, mx: -9999, my: -9999, px: -9999, py: -9999, strength: 0, target: 0, raf: 0 }
    let cancelled = false

    const parsePos = () => {
      const [px = 'center', py = '50%'] = pos.split(' ')
      const pct = (v) => (v === 'center' ? 0.5 : v === 'top' || v === 'left' ? 0 : v === 'bottom' || v === 'right' ? 1 : parseFloat(v) / 100)
      return [pct(px), pct(py)]
    }

    // Build the printed artwork once per size, at device resolution.
    const build = () => {
      const { img } = s
      if (!img || cancelled) return
      const rect = wrap.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      s.w = rect.width; s.h = rect.height; s.dpr = dpr
      const PW = Math.round(rect.width * dpr), PH = Math.round(rect.height * dpr)
      canvas.width = PW; canvas.height = PH

      const art = document.createElement('canvas')
      art.width = PW; art.height = PH
      const a = art.getContext('2d', { willReadFrequently: true })
      a.fillStyle = '#fff'; a.fillRect(0, 0, PW, PH)
      const W = rect.width, H = rect.height
      const [ox, oy] = parsePos()
      const base = Math.max(W / img.naturalWidth, H / img.naturalHeight)
      const dw = img.naturalWidth * base * zoom, dh = img.naturalHeight * base * zoom
      let dx = (W - img.naturalWidth * base) * ox
      let dy = (H - img.naturalHeight * base) * oy
      dx = W * 0.5 + (dx - W * 0.5) * zoom
      dy = H * origin + (dy - H * origin) * zoom
      a.filter = `grayscale(1) contrast(1.12) brightness(${bright})`
      a.imageSmoothingQuality = 'high'
      a.drawImage(img, dx * dpr, dy * dpr, dw * dpr, dh * dpr)
      a.filter = 'none'

      // Clustered-dot screen at 45°: ink dots grow with darkness (area-true),
      // soft-edged, then blended with the photo for a realistic print.
      const im = a.getImageData(0, 0, PW, PH)
      const px = im.data
      const k = Math.SQRT1_2 / SCREEN
      for (let y = 0, p = 0; y < PH; y++) {
        for (let x = 0; x < PW; x++, p += 4) {
          const lum = px[p] / 255
          const u = (x + y) * k, v = (x - y) * k
          const fu = u - Math.floor(u) - 0.5, fv = v - Math.floor(v) - 0.5
          const d = Math.sqrt(fu * fu + fv * fv) / Math.SQRT1_2 // 0 centre … 1 corner
          const ink = Math.sqrt(Math.max(0, 1 - lum)) // dot radius for area coverage
          const t = Math.min(1, Math.max(0, (ink - d) / 0.16 + 0.5))
          const halftone = 1 - t
          const out = (lum * (1 - MIX) + halftone * MIX) * 255
          px[p] = px[p + 1] = px[p + 2] = out
        }
      }
      a.putImageData(im, 0, 0)
      s.art = art
      draw()
      setReady(true)
    }

    const draw = () => {
      const { art, w, h, dpr } = s
      if (!art) return
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(art, 0, 0)
      if (s.strength <= 0.001) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.imageSmoothingEnabled = false
      const reach = RADIUS + PUSH
      const i0 = Math.max(0, Math.floor((s.px - reach) / TILE)), i1 = Math.min(Math.ceil(w / TILE), Math.ceil((s.px + reach) / TILE))
      const j0 = Math.max(0, Math.floor((s.py - reach) / TILE)), j1 = Math.min(Math.ceil(h / TILE), Math.ceil((s.py + reach) / TILE))
      ctx.fillStyle = '#fff'
      ctx.fillRect(i0 * TILE, j0 * TILE, (i1 - i0) * TILE, (j1 - j0) * TILE)
      for (let j = j0; j < j1; j++) {
        for (let i = i0; i < i1; i++) {
          const x = i * TILE, y = j * TILE
          let ddx = 0, ddy = 0
          const cx = x + TILE / 2 - s.px, cy = y + TILE / 2 - s.py
          const d = Math.hypot(cx, cy)
          if (d < RADIUS) {
            const f = (1 - d / RADIUS) ** 2 * s.strength
            const n = noise(i, j)
            const push = PUSH * f * (0.7 + n * 0.6)
            const kk = d > 0.001 ? push / d : 0
            ddx = cx * kk + (n - 0.5) * 1.2 * f
            ddy = cy * kk + (noise(j, i) - 0.5) * 1.2 * f
          }
          ctx.drawImage(art, x * dpr, y * dpr, TILE * dpr, TILE * dpr, x + ddx, y + ddy, TILE, TILE)
        }
      }
    }

    const tick = () => {
      s.strength += (s.target - s.strength) * 0.045
      s.px += (s.mx - s.px) * 0.09
      s.py += (s.my - s.py) * 0.09
      draw()
      if (s.target === 0 && s.strength < 0.002) { s.strength = 0; draw(); s.raf = 0; return }
      s.raf = requestAnimationFrame(tick)
    }
    const start = () => { if (!s.raf && !reduce) s.raf = requestAnimationFrame(tick) }
    const move = (e) => {
      const r = wrap.getBoundingClientRect()
      s.mx = e.clientX - r.left; s.my = e.clientY - r.top
      if (s.target === 0 && s.strength < 0.01) { s.px = s.mx; s.py = s.my }
      s.target = 1; start()
    }
    const leave = () => { s.target = 0; start() }

    const img = new Image()
    img.decoding = 'async'
    img.onload = () => { s.img = img; build() }
    img.src = `/_next/image?url=${encodeURIComponent(src)}&w=1080&q=90`

    const ro = new ResizeObserver(build)
    ro.observe(wrap)
    wrap.addEventListener('pointermove', move)
    wrap.addEventListener('pointerleave', leave)
    return () => {
      cancelled = true; ro.disconnect()
      wrap.removeEventListener('pointermove', move)
      wrap.removeEventListener('pointerleave', leave)
      if (s.raf) cancelAnimationFrame(s.raf)
    }
  }, [src, zoom, pos, origin, bright])

  return (
    <div ref={wrapRef} className="pp">
      <canvas ref={canvasRef} className="pp__canvas" role="img" aria-label={alt} data-ready={ready || undefined} />
    </div>
  )
}
