'use client'

import { useEffect, useId, useRef } from 'react'

// Heat-map wordmark: the text is filled with a moving black/white stripe, blurred,
// and the resulting luminance is remapped through a thermal colour table.
const R = '0 0 0 1 1 .953'
const G = '0 .0863 .6667 .7961 .2667 .5176'
const B = '0 .4275 1 .3608 0 1'

// Dark mode: electric glow — white core → cyan → blue → violet rim → page.
// Dark-mode hero wordmark only: crisp luminous blue outline, deep blue body.
const HERO_DARK = {
  R: '.05 .1 .2 .55 .3 .1',
  G: '.1 .25 .55 .8 .45 .12',
  B: '.4 .85 1 1 .95 .3',
}

export const DARK = {
  R: '.93 .62 .31 .18 .12 .08',
  G: '.95 .76 .49 .3 .17 .09',
  B: '1 1 1 .78 .42 .2',
}

// Light mode: the same blue glow, inverted for a white page.
export const LIGHT_BLUE = {
  R: '.04 .13 .17 .45 .76 .9',
  G: '.09 .3 .74 .55 .8 .93',
  B: '.36 .9 .98 1 1 1',
}

// White glow: bright core → silver → soft grey → page.
export const WHITE = {
  R: '1 .97 .88 .66 .38 .16',
  G: '1 .97 .89 .68 .4 .17',
  B: '1 1 .95 .76 .46 .2',
}

export function ColorFilter({ id, paper, table = { R, G, B }, x = '-10%', y = '-40%', width = '120%', height = '180%' }) {
  return (
    <filter id={id} x={x} y={y} width={width} height={height} colorInterpolationFilters="sRGB">
      <feGaussianBlur in="SourceAlpha" stdDeviation="11" />
      <feComponentTransfer result="glow">
        <feFuncA type="linear" slope="4" />
      </feComponentTransfer>
      <feFlood floodColor="#fff" result="paper" />
      <feComposite in="SourceGraphic" in2="paper" operator="over" />
      <feGaussianBlur stdDeviation="7.3" result="soft" />
      <feComponentTransfer>
        <feFuncA type="linear" slope=".12" />
      </feComponentTransfer>
      <feBlend in2="soft" mode="soft-light" />
      <feComponentTransfer>
        <feFuncR type="table" tableValues={`${table.R} ${paper}`} />
        <feFuncG type="table" tableValues={`${table.G} ${paper}`} />
        <feFuncB type="table" tableValues={`${table.B} ${paper}`} />
      </feComponentTransfer>
      <feComposite in2="glow" operator="in" />
    </filter>
  )
}

export default function Thermal({ text = 'webassure', className = '', tone }) {
  const uid = useId().replace(/:/g, '')
  const svgRef = useRef(null)
  const lightRef = useRef(null)

  // Hover: the shine follows the cursor and nearby letters lift individually.
  useEffect(() => {
    const svg = svgRef.current
    const light = lightRef.current
    if (!svg || !light) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const host = svg.parentElement
    const spans = Array.from(svg.querySelectorAll('.thermal__glass tspan'))
    const lift = spans.map(() => 0)
    let liftTarget = spans.map(() => 0)
    let centers = null
    let raf = 0
    let tgt = { az: 240, el: 52 }
    const cur = { ...tgt }
    const measure = () => {
      centers = spans.map((t) => {
        const b = t.getBBox()
        return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
      })
    }
    const tick = () => {
      let moving = false
      for (const k of ['az', 'el']) {
        const d = tgt[k] - cur[k]
        if (Math.abs(d) > 0.05) moving = true
        cur[k] += d * 0.12
      }
      light.setAttribute('azimuth', cur.az.toFixed(1))
      light.setAttribute('elevation', cur.el.toFixed(1))
      // dy is relative to the previous glyph, so set each one to the change in lift.
      let prev = 0
      spans.forEach((t, i) => {
        const d = liftTarget[i] - lift[i]
        if (Math.abs(d) > 0.05) moving = true
        lift[i] += d * 0.16
        t.setAttribute('dy', (-(lift[i] - prev)).toFixed(2))
        prev = lift[i]
      })
      raf = moving ? requestAnimationFrame(tick) : 0
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick) }
    const onMove = (e) => {
      const r = svg.getBoundingClientRect()
      const nx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2)
      const ny = (e.clientY - (r.top + r.height / 2)) / (r.height / 2)
      tgt = { az: ((Math.atan2(ny, nx) * 180) / Math.PI + 360) % 360, el: 62 - Math.min(1, Math.hypot(nx, ny)) * 26 }
      if (!centers) measure()
      const m = svg.getScreenCTM()
      if (m) {
        const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
        liftTarget = centers.map((c) => {
          const dist = Math.hypot(pt.x - c.x, (pt.y - c.y) * 0.6)
          const k = Math.max(0, 1 - dist / 170)
          return 14 * k * k * (3 - 2 * k)
        })
      }
      kick()
    }
    const onLeave = () => { tgt = { az: 240, el: 52 }; liftTarget = spans.map(() => 0); kick() }
    const onResize = () => { centers = null }
    host.addEventListener('pointermove', onMove)
    host.addEventListener('pointerleave', onLeave)
    window.addEventListener('resize', onResize)
    return () => {
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(raf)
    }
  }, [])
  const stripe = `${uid}-stripe`
  const material = `${uid}-material`
  const color = `${uid}-color`
  const colorDark = `${uid}-color-dark`

  return (
    <svg
      ref={svgRef}
      className={`thermal ${className}`}
      viewBox="-40 -30 980 230"
      overflow="visible"
      aria-hidden="true"
      style={{
        '--thermal-light': `url(#${color})`,
        '--thermal-dark': `url(#${colorDark})`,
        '--stripe-light': `url(#${stripe})`,
        '--stripe-dark': `url(#${stripe}-dark)`,
      }}
    >
      <defs>
        <linearGradient id={stripe} gradientUnits="userSpaceOnUse" x2="486" spreadMethod="repeat" gradientTransform="rotate(-35)">
          <stop stopColor="#6a6a6a" />
          <stop offset=".5" stopColor="#000" />
          <stop offset="1" stopColor="#6a6a6a" />
          <animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="486 0" dur="4.4s" repeatCount="indefinite" additive="sum" />
        </linearGradient>
        {/* Dark mode: a shallower stripe keeps every letter in the blue/orange core
            instead of drifting into pink haze against the dark page. */}
        <linearGradient id={`${stripe}-dark`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="900" y2="0">
          <stop stopColor="#1c1c1c" />
          <stop offset=".35" stopColor="#505050" />
          <stop offset=".65" stopColor="#505050" />
          <stop offset="1" stopColor="#1c1c1c" />
        </linearGradient>
        <filter id={material} x="-3%" y="-15%" width="106%" height="130%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="4.5" />
          <feComposite in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" />
          <feBlend in="SourceGraphic" mode="overlay" />
        </filter>
        <ColorFilter id={color} paper="1" table={LIGHT_BLUE} />
        <ColorFilter id={colorDark} paper="0.0706" table={tone === 'white' ? WHITE : HERO_DARK} />
        {/* Dark mode: solid glossy blue with a moving gradient inside and a 3D bevel. */}
        <linearGradient id={`${uid}-gfill`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="900" y2="60" spreadMethod="reflect">
          <stop offset="0" stopColor="#1b3bd1" />
          <stop offset=".35" stopColor="#3f6dff" />
          <stop offset=".6" stopColor="#7ab8ff" />
          <stop offset="1" stopColor="#2a4fe6" />
          <animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="1800 0" dur="9s" repeatCount="indefinite" />
        </linearGradient>
        <filter id={`${uid}-glass`} x="-10%" y="-40%" width="120%" height="190%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="b" />
          <feSpecularLighting in="b" surfaceScale="5.5" specularConstant="1.1" specularExponent="24" lightingColor="#ffffff" result="spec">
            <feDistantLight ref={lightRef} azimuth="240" elevation="52" />
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn" />
          <feComposite in="SourceGraphic" in2="specIn" operator="arithmetic" k1="0" k2="1" k3="0.8" k4="0" result="lit" />
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="ib" />
          <feOffset in="ib" dy="-3" result="io" />
          <feComposite in="SourceAlpha" in2="io" operator="out" result="inner" />
          <feFlood floodColor="#0b1a6b" floodOpacity=".55" />
          <feComposite in2="inner" operator="in" result="innerShade" />
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="sb" />
          <feOffset in="sb" dy="6" result="so" />
          <feFlood floodColor="#000" floodOpacity=".55" />
          <feComposite in2="so" operator="in" result="shadow" />
          <feMerge>
            <feMergeNode in="shadow" />
            <feMergeNode in="lit" />
            <feMergeNode in="innerShade" />
          </feMerge>
        </filter>
      </defs>
      <g className="thermal__color">
        <text
          x="450"
          y="150"
          textAnchor="middle"
          fontSize="168"
          fontWeight="700"
          letterSpacing="7"
          className="thermal__text"
          filter={`url(#${material})`}
          style={{ fontFamily: 'var(--font-mark)' }}
        >
          {text}
        </text>
      </g>
      <g className="thermal__glass">
        <text
          x="450"
          y="150"
          textAnchor="middle"
          fontSize="168"
          fontWeight="800"
          letterSpacing="7"
          fill={`url(#${uid}-gfill)`}
          filter={`url(#${uid}-glass)`}
          style={{ fontFamily: 'var(--font-mark)' }}
        >
          {Array.from(text).map((ch, i) => (
            <tspan key={i}>{ch}</tspan>
          ))}
        </text>
      </g>
    </svg>
  )
}
