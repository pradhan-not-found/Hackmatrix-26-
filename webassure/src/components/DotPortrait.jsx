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

      // 2. Keep only a grid of round dots (pitch snapped to device pixels).
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
