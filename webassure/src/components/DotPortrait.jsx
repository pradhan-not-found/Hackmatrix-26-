'use client'

import { useEffect, useRef } from 'react'

// Team portrait built entirely from dots (no photo shown). Light dots on black,
// laid out on a staggered (hexagonal) lattice like a print screen. Each dot's
// area matches the brightness of the photo region it covers (area-averaged),
// which keeps tones true so the face reads realistically. Dark hair and
// clothing keep a fine minimum dot so the silhouette stays visible, and the
// studio backdrop tapers smoothly to nothing (no hard cut-out edges).
// Framing matches object-fit: cover with the given object-position and zoom.

const PITCH = 3.4 // px between dot centres
const SS = 3 // supersampling per dot (area average)
const INK = '#ececee'

export default function DotPortrait({ src, zoom = 1, pos = 'center 22%', origin = 0.3 }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    const box = canvas?.parentElement
    if (!canvas || !box) return
    let img = null, cancelled = false

    const parsePos = () => {
      const [px = 'center', py = '50%'] = pos.split(' ')
      const pct = (v) => (v === 'center' ? 0.5 : v === 'top' || v === 'left' ? 0 : v === 'bottom' || v === 'right' ? 1 : parseFloat(v) / 100)
      return [pct(px), pct(py)]
    }
    const smooth = (e0, e1, t) => { const u = Math.min(1, Math.max(0, (t - e0) / (e1 - e0))); return u * u * (3 - 2 * u) }

    const render = () => {
      if (!img || cancelled) return
      const W = box.clientWidth, H = box.clientHeight
      if (!W || !H) return
      const dpr = Math.min(3, window.devicePixelRatio || 1)
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
      const ctx = canvas.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      const pitch = Math.max(3, Math.round(PITCH * dpr)) / dpr
      const rowH = pitch * 0.866 // hex lattice row spacing
      const cols = Math.ceil(W / pitch) + 1, rows = Math.ceil(H / rowH) + 1

      // Sample the framed photo at SS×SS pixels per dot, then area-average.
      const sw = cols * SS, sh = rows * SS
      const s = document.createElement('canvas')
      s.width = sw; s.height = sh
      const sx = s.getContext('2d', { willReadFrequently: true })
      sx.fillStyle = '#fff'; sx.fillRect(0, 0, sw, sh)
      const [ox, oy] = parsePos()
      const base = Math.max(W / img.naturalWidth, H / img.naturalHeight)
      const dw = img.naturalWidth * base * zoom, dh = img.naturalHeight * base * zoom
      let dx = (W - img.naturalWidth * base) * ox
      let dy = (H - img.naturalHeight * base) * oy
      dx = W * 0.5 + (dx - W * 0.5) * zoom
      dy = H * origin + (dy - H * origin) * zoom
      const kx = sw / (cols * pitch), ky = sh / (rows * rowH)
      sx.filter = 'grayscale(1)'
      sx.imageSmoothingQuality = 'high'
      sx.drawImage(img, dx * kx, dy * ky, dw * kx, dh * ky)
      const raw = sx.getImageData(0, 0, sw, sh).data

      const n = cols * rows
      const lum = new Float32Array(n)
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          let sum = 0
          for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) sum += raw[((r * SS + j) * sw + c * SS + i) * 4]
          lum[r * cols + c] = sum / (SS * SS * 255)
        }
      }

      // Backdrop: light area connected to the frame edges (on the dot grid),
      // softened so it tapers instead of ending in a hard edge.
      let bg = 0, bc = 0
      for (let c = 0; c < cols; c++) { bg += lum[c] + lum[cols + c]; bc += 2 }
      bg /= bc
      const thr = bg - 0.16
      const key = new Float32Array(n)
      const stack = []
      const push = (i) => { if (!key[i] && lum[i] >= thr) { key[i] = 1; stack.push(i) } }
      for (let c = 0; c < cols; c++) { push(c); push((rows - 1) * cols + c) }
      for (let r = 0; r < rows; r++) { push(r * cols); push(r * cols + cols - 1) }
      while (stack.length) {
        const i = stack.pop(), c = i % cols
        if (c > 0) push(i - 1)
        if (c < cols - 1) push(i + 1)
        if (i >= cols) push(i - cols)
        if (i < n - cols) push(i + cols)
      }
      for (let pass = 0; pass < 3; pass++) {
        const tmp = key.slice()
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          let sum = 0, k = 0
          for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
            const rr = r + j, cc = c + i
            if (rr >= 0 && cc >= 0 && rr < rows && cc < cols) { sum += tmp[rr * cols + cc]; k++ }
          }
          key[r * cols + c] = sum / k
        }
      }

      // Tone range of the subject (ignoring backdrop), for a true-to-photo stretch.
      const vals = []
      for (let i = 0; i < n; i++) if (key[i] < 0.5) vals.push(lum[i])
      vals.sort((a, b) => a - b)
      const lo = vals.length ? vals[Math.floor(vals.length * 0.01)] : 0
      const hi = vals.length ? vals[Math.floor(vals.length * 0.995)] : 1
      const span = Math.max(0.1, hi - lo)

      // Draw: dot area ∝ brightness (r = pitch·√(b/π)), capped where dots touch.
      const rMax = pitch * 0.56
      const path = new Path2D()
      for (let r = 0; r < rows; r++) {
        const y = r * rowH + rowH / 2
        const off = r % 2 ? pitch / 2 : 0
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c
          const subject = 1 - smooth(0.12, 0.55, key[i])
          if (subject < 0.02) continue
          const b = Math.min(1, Math.max(0, (lum[i] - lo) / span))
          const tone = 0.06 + 0.94 * Math.pow(b, 1.1) // fine minimum dot for dark hair/clothing
          const rad = Math.min(rMax, pitch * Math.sqrt(tone / Math.PI) * 1.05) * subject
          if (rad < 0.25) continue
          const x = c * pitch + pitch / 2 + off
          path.moveTo(x + rad, y); path.arc(x, y, rad, 0, Math.PI * 2)
        }
      }
      ctx.fillStyle = INK
      ctx.fill(path)
    }

    const load = new Image()
    load.decoding = 'async'
    load.onload = () => { img = load; render() }
    load.src = `/_next/image?url=${encodeURIComponent(src)}&w=1080&q=90`

    const ro = new ResizeObserver(render)
    ro.observe(box)
    return () => { cancelled = true; ro.disconnect() }
  }, [src, zoom, pos, origin])

  return <canvas ref={ref} className="dots" aria-hidden="true" />
}
