'use client'

import { useEffect, useRef, useState } from 'react'

// Renders a vector shape as glowing ASCII: the shape is rasterised to an
// off-screen canvas, sampled on a character grid, and each covered cell gets a
// glyph by coverage. Edge glyphs shimmer while the art is on screen.
const RAMP = ['-', '~', '^', 'v', 'V', 'A', 'M']

const round = (ctx, w) => {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = w
}
const rr = (ctx, x, y, w, h, r) => {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

const SHAPES = {
  /* ---- signal tiles ---- */
  redirect: (ctx, s) => {
    round(ctx, s * 0.11)
    ctx.beginPath()
    ctx.moveTo(s * 0.2, s * 0.86)
    ctx.bezierCurveTo(s * 0.18, s * 0.42, s * 0.42, s * 0.28, s * 0.78, s * 0.3)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(s * 0.62, s * 0.14)
    ctx.lineTo(s * 0.82, s * 0.3)
    ctx.lineTo(s * 0.64, s * 0.48)
    ctx.stroke()
  },
  spark: (ctx, s) => {
    const star = (cx, cy, r) => {
      ctx.beginPath()
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI / 4) * i - Math.PI / 2
        const rad = i % 2 ? r * 0.22 : r
        ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad)
      }
      ctx.closePath()
      ctx.fill()
    }
    star(s * 0.44, s * 0.52, s * 0.36)
    star(s * 0.76, s * 0.34, s * 0.12)
    star(s * 0.16, s * 0.5, s * 0.07)
  },
  check: (ctx, s) => {
    round(ctx, s * 0.13)
    ctx.beginPath()
    ctx.moveTo(s * 0.16, s * 0.56)
    ctx.lineTo(s * 0.4, s * 0.8)
    ctx.lineTo(s * 0.86, s * 0.2)
    ctx.stroke()
  },

  /* ---- how it works ---- */
  link: (ctx, s) => {
    round(ctx, s * 0.1)
    ctx.save()
    ctx.translate(s / 2, s / 2)
    ctx.rotate(-Math.PI / 4)
    rr(ctx, -s * 0.38, -s * 0.12, s * 0.42, s * 0.24, s * 0.12)
    ctx.stroke()
    rr(ctx, -s * 0.04, -s * 0.12, s * 0.42, s * 0.24, s * 0.12)
    ctx.stroke()
    ctx.restore()
  },
  radar: (ctx, s) => {
    round(ctx, s * 0.06)
    for (const r of [0.38, 0.24]) {
      ctx.beginPath()
      ctx.arc(s / 2, s / 2, s * r, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.moveTo(s / 2, s / 2)
    ctx.arc(s / 2, s / 2, s * 0.38, -Math.PI / 2, -Math.PI / 6)
    ctx.closePath()
    ctx.fill()
  },
  gauge: (ctx, s) => {
    round(ctx, s * 0.1)
    ctx.beginPath()
    ctx.arc(s / 2, s * 0.64, s * 0.36, Math.PI, 0)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(s / 2, s * 0.64)
    ctx.lineTo(s * 0.72, s * 0.38)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(s / 2, s * 0.64, s * 0.07, 0, Math.PI * 2)
    ctx.fill()
  },
  nodes: (ctx, s) => {
    round(ctx, s * 0.06)
    const p = [[0.22, 0.72], [0.5, 0.26], [0.78, 0.72]]
    ctx.beginPath()
    ctx.moveTo(s * p[0][0], s * p[0][1])
    ctx.lineTo(s * p[1][0], s * p[1][1])
    ctx.lineTo(s * p[2][0], s * p[2][1])
    ctx.closePath()
    ctx.stroke()
    for (const [x, y] of p) {
      ctx.beginPath()
      ctx.arc(s * x, s * y, s * 0.12, 0, Math.PI * 2)
      ctx.fill()
    }
  },

  /* ---- sectors ---- */
  bank: (ctx, s) => {
    ctx.beginPath()
    ctx.moveTo(s * 0.5, s * 0.1)
    ctx.lineTo(s * 0.9, s * 0.34)
    ctx.lineTo(s * 0.1, s * 0.34)
    ctx.closePath()
    ctx.fill()
    for (const x of [0.2, 0.42, 0.64]) ctx.fillRect(s * x, s * 0.4, s * 0.14, s * 0.36)
    ctx.fillRect(s * 0.1, s * 0.8, s * 0.8, s * 0.1)
  },
  cap: (ctx, s) => {
    ctx.beginPath()
    ctx.moveTo(s * 0.5, s * 0.16)
    ctx.lineTo(s * 0.94, s * 0.38)
    ctx.lineTo(s * 0.5, s * 0.6)
    ctx.lineTo(s * 0.06, s * 0.38)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(s * 0.24, s * 0.5)
    ctx.lineTo(s * 0.24, s * 0.74)
    ctx.quadraticCurveTo(s * 0.5, s * 0.92, s * 0.76, s * 0.74)
    ctx.lineTo(s * 0.76, s * 0.5)
    ctx.fill()
  },
  briefcase: (ctx, s) => {
    rr(ctx, s * 0.1, s * 0.32, s * 0.8, s * 0.52, s * 0.08)
    ctx.fill()
    round(ctx, s * 0.08)
    rr(ctx, s * 0.36, s * 0.14, s * 0.28, s * 0.2, s * 0.05)
    ctx.stroke()
  },
  cart: (ctx, s) => {
    round(ctx, s * 0.08)
    ctx.beginPath()
    ctx.moveTo(s * 0.08, s * 0.2)
    ctx.lineTo(s * 0.22, s * 0.2)
    ctx.lineTo(s * 0.32, s * 0.64)
    ctx.lineTo(s * 0.8, s * 0.64)
    ctx.lineTo(s * 0.9, s * 0.32)
    ctx.lineTo(s * 0.26, s * 0.32)
    ctx.stroke()
    for (const x of [0.36, 0.74]) {
      ctx.beginPath()
      ctx.arc(s * x, s * 0.82, s * 0.08, 0, Math.PI * 2)
      ctx.fill()
    }
  },
  dome: (ctx, s) => {
    ctx.beginPath()
    ctx.arc(s * 0.5, s * 0.42, s * 0.24, Math.PI, 0)
    ctx.fill()
    ctx.fillRect(s * 0.47, s * 0.08, s * 0.06, s * 0.12)
    for (const x of [0.18, 0.36, 0.54, 0.72]) ctx.fillRect(s * x, s * 0.46, s * 0.1, s * 0.32)
    ctx.fillRect(s * 0.1, s * 0.8, s * 0.8, s * 0.1)
  },
  card: (ctx, s) => {
    round(ctx, s * 0.08)
    rr(ctx, s * 0.08, s * 0.22, s * 0.84, s * 0.56, s * 0.08)
    ctx.stroke()
    ctx.fillRect(s * 0.08, s * 0.36, s * 0.84, s * 0.1)
    ctx.fillRect(s * 0.2, s * 0.6, s * 0.2, s * 0.06)
  },
  plus: (ctx, s) => {
    ctx.fillRect(s * 0.38, s * 0.12, s * 0.24, s * 0.76)
    ctx.fillRect(s * 0.12, s * 0.38, s * 0.76, s * 0.24)
  },
  server: (ctx, s) => {
    for (const y of [0.14, 0.42, 0.7]) {
      rr(ctx, s * 0.12, s * y, s * 0.76, s * 0.2, s * 0.05)
      ctx.fill()
    }
  },
}

function build(shape, cols, rows) {
  const s = 240
  const c = document.createElement('canvas')
  c.width = s
  c.height = s
  const ctx = c.getContext('2d')
  ctx.fillStyle = ctx.strokeStyle = '#fff'
  SHAPES[shape](ctx, s)
  const data = ctx.getImageData(0, 0, s, s).data
  const cw = s / cols
  const ch = s / rows
  const grid = []
  for (let r = 0; r < rows; r++) {
    const row = []
    for (let col = 0; col < cols; col++) {
      let sum = 0
      let n = 0
      for (let y = Math.floor(r * ch); y < (r + 1) * ch; y += 2) {
        for (let x = Math.floor(col * cw); x < (col + 1) * cw; x += 2) {
          sum += data[(y * s + x) * 4 + 3]
          n++
        }
      }
      row.push(sum / n / 255)
    }
    grid.push(row)
  }
  return grid
}

function render(grid, t) {
  return grid
    .map((row, r) =>
      row
        .map((v, c) => {
          if (v < 0.08) return ' '
          let i = Math.min(RAMP.length - 1, Math.floor(v * RAMP.length))
          if (v < 0.85 && Math.sin(t * 0.004 + r * 1.7 + c * 2.3) > 0.55) i = Math.max(0, i - 1)
          return RAMP[i]
        })
        .join('')
    )
    .join('\n')
}

export default function AsciiArt({ shape = 'check', cols = 26, rows = 15, color = '#44f33e', label, size }) {
  const [text, setText] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const grid = build(shape, cols, rows)
    setText(render(grid, 0))
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    let last = 0
    const loop = (t) => {
      if (t - last > 90) {
        setText(render(grid, t))
        last = t
      }
      raf = requestAnimationFrame(loop)
    }
    // Only shimmer while visible.
    const io = new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf)
      if (e.isIntersecting) raf = requestAnimationFrame(loop)
    })
    if (ref.current) io.observe(ref.current)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [shape, cols, rows])

  return (
    <pre ref={ref} className="ascii" style={{ '--c': color, ...(size ? { fontSize: size } : null) }} role="img" aria-label={label}>
      {text}
    </pre>
  )
}
