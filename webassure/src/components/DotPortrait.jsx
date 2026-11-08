'use client'

import { useEffect, useRef } from 'react'

// Renders a photo as a fine halftone dot portrait on a canvas that fills its
// (positioned) parent. Each dot's size follows the darkness of the photo at
// that point, after sharpening and a percentile contrast stretch, so the face
// stays recognisable. Framing matches the photo: object-fit cover with the
// same object-position and zoom.

export default function DotPortrait({ src, zoom = 1, pos = 'center 22%', origin = 0.3, cell = 4 }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    const box = canvas?.parentElement
    if (!canvas || !box) return
    let img = null
    let cancelled = false

    const parsePos = () => {
      const [px = 'center', py = '50%'] = pos.split(' ')
      const pct = (v) => (v === 'center' ? 0.5 : v === 'top' || v === 'left' ? 0 : v === 'bottom' || v === 'right' ? 1 : parseFloat(v) / 100)
      return [pct(px), pct(py)]
    }

    const render = () => {
      if (!img || cancelled) return
      const W = box.clientWidth, H = box.clientHeight
      if (!W || !H) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
      const ctx = canvas.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const cols = Math.ceil(W / cell), rows = Math.ceil(H / cell)

      // Sample the photo at one pixel per dot, framed exactly like the <img>.
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

      // Unsharp mask: brings out eyes, glasses, hairline and jaw.
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
      for (let i = 0; i < n; i++) lum[i] = Math.min(1, Math.max(0, lum[i] + 0.9 * (lum[i] - blur[i])))

      // Percentile contrast stretch (2%–98%) so every portrait uses the full range.
      const sorted = Array.from(lum).sort((a, b) => a - b)
      // The backdrop tone (read from the top corners) maps to white, so a grey
      // studio backdrop stays clean paper instead of filling with dots.
      const k = Math.max(2, Math.floor(cols * 0.08))
      let bg = 0, bc = 0
      for (let y = 0; y < 3; y++) for (let x = 0; x < k; x++) { bg += lum[y * cols + x] + lum[y * cols + cols - 1 - x]; bc += 2 }
      const lo = sorted[Math.floor(n * 0.02)]
      const hi = Math.min(sorted[Math.floor(n * 0.98)], bg / bc - 0.04)
      const span = Math.max(0.05, hi - lo)

      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = getComputedStyle(canvas).color
      const maxR = cell * 0.56
      ctx.beginPath()
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const v = Math.min(1, Math.max(0, (lum[y * cols + x] - lo) / span))
          const dark = Math.pow(1 - v, 1.15)
          if (dark < 0.04) continue
          const r = maxR * Math.sqrt(dark) // dot area ∝ darkness
          const cx = x * cell + cell / 2, cy = y * cell + cell / 2
          ctx.moveTo(cx + r, cy)
          ctx.arc(cx, cy, r, 0, Math.PI * 2)
        }
      }
      ctx.fill()
    }

    const load = new Image()
    load.decoding = 'async'
    load.onload = () => { img = load; render() }
    load.src = `/_next/image?url=${encodeURIComponent(src)}&w=1080&q=85`

    const ro = new ResizeObserver(render)
    ro.observe(box)
    return () => { cancelled = true; ro.disconnect() }
  }, [src, zoom, pos, origin, cell])

  return <canvas ref={ref} className="dots" aria-hidden="true" />
}
