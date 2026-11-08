'use client'

import { useEffect, useRef } from 'react'

// Shows the exact photo through a fine grid of round dots: the photo is drawn
// at full resolution (greyscale), then masked so only the dots remain. Every
// dot carries the real pixels of the photo, so the face is the same image,
// just seen through a dot screen. Framing matches the photo: object-fit cover
// with the same object-position and zoom.

export default function DotPortrait({ src, zoom = 1, pos = 'center 22%', origin = 0.3, cell = 3 }) {
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
      const dpr = Math.min(3, window.devicePixelRatio || 1)
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
      const ctx = canvas.getContext('2d')
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      // 1. The real photo, framed exactly like the <img>.
      const [ox, oy] = parsePos()
      const base = Math.max(W / img.naturalWidth, H / img.naturalHeight)
      const dw = img.naturalWidth * base * zoom, dh = img.naturalHeight * base * zoom
      let dx = (W - img.naturalWidth * base) * ox
      let dy = (H - img.naturalHeight * base) * oy
      dx = W * 0.5 + (dx - W * 0.5) * zoom
      dy = H * origin + (dy - H * origin) * zoom
      ctx.filter = 'grayscale(1) contrast(1.12)'
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, dx, dy, dw, dh)
      ctx.filter = 'none'

      // 2. Cut out the studio backdrop so the person sits on black: flood-fill
      // the light area connected to the photo's edges and make it transparent.
      // Dark clothing is lifted a little so it still reads as dots on black.
      const PW = canvas.width, PH = canvas.height
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0)
      const im = ctx.getImageData(0, 0, PW, PH)
      const px = im.data
      let bg = 0, bc = 0
      const k = Math.max(4, Math.floor(PW * 0.06))
      for (let y = 0; y < k; y++) for (let x = 0; x < k; x++) {
        bg += px[(y * PW + x) * 4] + px[(y * PW + PW - 1 - x) * 4]; bc += 2
      }
      const thr = bg / bc - 26
      const seen = new Uint8Array(PW * PH)
      const stack = []
      const push = (i) => { if (!seen[i] && px[i * 4] >= thr) { seen[i] = 1; stack.push(i) } }
      for (let x = 0; x < PW; x++) { push(x); push((PH - 1) * PW + x) }
      for (let y = 0; y < PH; y++) { push(y * PW); push(y * PW + PW - 1) }
      while (stack.length) {
        const i = stack.pop(), x = i % PW
        if (x > 0) push(i - 1)
        if (x < PW - 1) push(i + 1)
        if (i >= PW) push(i - PW)
        if (i < PW * (PH - 1)) push(i + PW)
      }
      // Soft fade toward the bottom and outer sides, so the shoulders and
      // shirt dissolve into black instead of ending at the photo's hard edges.
      const smooth = (e0, e1, t) => { const u = Math.min(1, Math.max(0, (t - e0) / (e1 - e0))); return u * u * (3 - 2 * u) }
      const fadeY = new Float32Array(PH), fadeX = new Float32Array(PW)
      for (let y = 0; y < PH; y++) fadeY[y] = 1 - smooth(0.66, 0.98, y / PH)
      for (let x = 0; x < PW; x++) { const t = Math.min(x, PW - 1 - x) / PW; fadeX[x] = smooth(0, 0.16, t) }
      for (let i = 0, p = 0; i < seen.length; i++, p += 4) {
        if (seen[i]) { px[p + 3] = 0; continue }
        const v = 46 + px[p] * 0.82 // lift shadows off pure black
        px[p] = px[p + 1] = px[p + 2] = v
        const y = (i / PW) | 0, x = i - y * PW
        // sides fade only below the face, so hair and ears are never dimmed
        const side = 1 - (1 - fadeX[x]) * smooth(0.45, 0.7, y / PH)
        px[p + 3] = 255 * fadeY[y] * side
      }
      ctx.putImageData(im, 0, 0)
      ctx.restore()

      // 3. Keep only a grid of round dots (pitch snapped to device pixels).
      const pitch = Math.max(2, Math.round(cell * dpr)) / dpr
      const r = pitch * 0.47
      const dots = new Path2D()
      for (let y = pitch / 2; y < H + pitch; y += pitch) {
        for (let x = pitch / 2; x < W + pitch; x += pitch) {
          dots.moveTo(x + r, y); dots.arc(x, y, r, 0, Math.PI * 2)
        }
      }
      ctx.globalCompositeOperation = 'destination-in'
      ctx.fill(dots)
      ctx.globalCompositeOperation = 'source-over'
    }

    const load = new Image()
    load.decoding = 'async'
    load.onload = () => { img = load; render() }
    load.src = `/_next/image?url=${encodeURIComponent(src)}&w=1080&q=90`

    const ro = new ResizeObserver(render)
    ro.observe(box)
    return () => { cancelled = true; ro.disconnect() }
  }, [src, zoom, pos, origin, cell])

  return <canvas ref={ref} className="dots" aria-hidden="true" />
}
