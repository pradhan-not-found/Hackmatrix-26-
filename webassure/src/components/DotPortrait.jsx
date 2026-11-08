'use client'

import { useEffect, useRef } from 'react'

// Renders a photo as a dot-screen portrait on a canvas that fills its
// (positioned) parent. Every dot takes the photo's own grey at that point, so
// the full tonal detail of the face survives; dot size also grows slightly in
// darker areas. Moving the pointer over it disperses the nearby dots, which
// spring back when it leaves. Framing matches the photo: object-fit cover with
// the same object-position and zoom.

const INK = [20, 20, 22]
const PAPER = [244, 244, 242]
const LEVELS = 24
const RADIUS = 70 // px, pointer influence
const PUSH = 26 // px, max displacement

export default function DotPortrait({ src, zoom = 1, pos = 'center 22%', origin = 0.3, cell = 2.6 }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    const box = canvas?.parentElement
    if (!canvas || !box) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let img = null, cancelled = false, raf = 0
    let W = 0, H = 0, ctx = null
    let dots = null // Float32Array: hx, hy, x, y, vx, vy, r, level
    const pointer = { x: -1e4, y: -1e4, in: false }

    const parsePos = () => {
      const [px = 'center', py = '50%'] = pos.split(' ')
      const pct = (v) => (v === 'center' ? 0.5 : v === 'top' || v === 'left' ? 0 : v === 'bottom' || v === 'right' ? 1 : parseFloat(v) / 100)
      return [pct(px), pct(py)]
    }

    const colors = Array.from({ length: LEVELS }, (_, i) => {
      const t = i / (LEVELS - 1) // 0 ink … 1 paper
      const c = INK.map((v, k) => Math.round(v + (PAPER[k] - v) * t))
      return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
    })

    const build = () => {
      if (!img || cancelled) return
      W = box.clientWidth; H = box.clientHeight
      if (!W || !H) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
      ctx = canvas.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const cols = Math.ceil(W / cell), rows = Math.ceil(H / cell)
      const s = document.createElement('canvas')
      s.width = cols; s.height = rows
      const sx = s.getContext('2d', { willReadFrequently: true })
      sx.fillStyle = '#fff'; sx.fillRect(0, 0, cols, rows)
      const [ox, oy] = parsePos()
      const base = Math.max(W / img.naturalWidth, H / img.naturalHeight)
      const dw = img.naturalWidth * base * zoom, dh = img.naturalHeight * base * zoom
      let dx = (W - img.naturalWidth * base) * ox
      let dy = (H - img.naturalHeight * base) * oy
      dx = W * 0.5 + (dx - W * 0.5) * zoom
      dy = H * origin + (dy - H * origin) * zoom
      sx.filter = 'grayscale(1)'
      sx.imageSmoothingQuality = 'high'
      sx.drawImage(img, dx * cols / W, dy * rows / H, dw * cols / W, dh * rows / H)
      const raw = sx.getImageData(0, 0, cols, rows).data
      const n = cols * rows
      const lum = new Float32Array(n)
      for (let i = 0; i < n; i++) lum[i] = raw[i * 4] / 255

      // Light unsharp mask so eyes, brows, glasses and mouth stay defined.
      const blur = new Float32Array(n)
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          let sum = 0, c = 0
          for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
            const xx = x + i, yy = y + j
            if (xx >= 0 && yy >= 0 && xx < cols && yy < rows) { sum += lum[yy * cols + xx]; c++ }
          }
          blur[y * cols + x] = sum / c
        }
      }
      for (let i = 0; i < n; i++) lum[i] = Math.min(1, Math.max(0, lum[i] + 0.6 * (lum[i] - blur[i])))

      // Backdrop tone (top corners) maps to paper; darkest 1% maps to ink.
      const k = Math.max(2, Math.floor(cols * 0.08))
      let bg = 0, bc = 0
      for (let y = 0; y < 3; y++) for (let x = 0; x < k; x++) { bg += lum[y * cols + x] + lum[y * cols + cols - 1 - x]; bc += 2 }
      const sorted = Array.from(lum).sort((a, b) => a - b)
      const lo = sorted[Math.floor(n * 0.01)]
      const hi = Math.max(lo + 0.2, bg / bc - 0.03)

      const list = []
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const t = Math.min(1, Math.max(0, (lum[y * cols + x] - lo) / (hi - lo)))
          // gentle S-curve: deeper shadows and mid-tones, clean highlights
          const v = Math.pow(t * t * (3 - 2 * t), 1.15)
          if (v > 0.97) continue // paper
          const hx = x * cell + cell / 2, hy = y * cell + cell / 2
          const r = cell * 0.5 * (0.62 + 0.38 * (1 - v))
          list.push(hx, hy, hx, hy, 0, 0, r, Math.round(v * (LEVELS - 1)))
        }
      }
      dots = new Float32Array(list)
      draw()
    }

    const draw = () => {
      if (!ctx || !dots) return
      ctx.clearRect(0, 0, W, H)
      const paths = Array.from({ length: LEVELS }, () => new Path2D())
      for (let i = 0; i < dots.length; i += 8) {
        const x = dots[i + 2], y = dots[i + 3], r = dots[i + 6]
        const p = paths[dots[i + 7]]
        p.moveTo(x + r, y); p.arc(x, y, r, 0, Math.PI * 2)
      }
      for (let l = 0; l < LEVELS; l++) { ctx.fillStyle = colors[l]; ctx.fill(paths[l]) }
    }

    // Dispersion: dots near the pointer are pushed outward and spring home.
    const step = () => {
      let moving = false
      for (let i = 0; i < dots.length; i += 8) {
        const hx = dots[i], hy = dots[i + 1]
        let tx = hx, ty = hy
        if (pointer.in) {
          const ddx = hx - pointer.x, ddy = hy - pointer.y
          const d = Math.hypot(ddx, ddy)
          if (d < RADIUS && d > 0.001) {
            const f = Math.pow(1 - d / RADIUS, 2) * PUSH
            tx = hx + (ddx / d) * f; ty = hy + (ddy / d) * f
          }
        }
        let vx = dots[i + 4], vy = dots[i + 5]
        vx = (vx + (tx - dots[i + 2]) * 0.14) * 0.72
        vy = (vy + (ty - dots[i + 3]) * 0.14) * 0.72
        dots[i + 2] += vx; dots[i + 3] += vy
        dots[i + 4] = vx; dots[i + 5] = vy
        if (Math.abs(vx) > 0.02 || Math.abs(vy) > 0.02 || Math.abs(dots[i + 2] - hx) > 0.05 || Math.abs(dots[i + 3] - hy) > 0.05) moving = true
      }
      draw()
      raf = moving || pointer.in ? requestAnimationFrame(step) : 0
    }
    const kick = () => { if (!raf && dots && !reduce) raf = requestAnimationFrame(step) }

    const onMove = (e) => {
      const b = canvas.getBoundingClientRect()
      pointer.x = e.clientX - b.left; pointer.y = e.clientY - b.top; pointer.in = true
      kick()
    }
    const onLeave = () => { pointer.in = false; kick() }
    box.addEventListener('pointermove', onMove)
    box.addEventListener('pointerleave', onLeave)

    const load = new Image()
    load.decoding = 'async'
    load.onload = () => { img = load; build() }
    load.src = `/_next/image?url=${encodeURIComponent(src)}&w=1080&q=85`

    const ro = new ResizeObserver(build)
    ro.observe(box)
    return () => {
      cancelled = true; cancelAnimationFrame(raf); ro.disconnect()
      box.removeEventListener('pointermove', onMove)
      box.removeEventListener('pointerleave', onLeave)
    }
  }, [src, zoom, pos, origin, cell])

  return <canvas ref={ref} className="dots" aria-hidden="true" />
}
