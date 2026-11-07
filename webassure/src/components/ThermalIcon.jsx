'use client'

import { useEffect, useId, useRef } from 'react'
import { ColorFilter, DARK, LIGHT_BLUE } from './Thermal.jsx'

// Icons drawn with the same heat-map treatment as the hero wordmark:
// a moving black/white stripe, blurred and remapped through the thermal palette.
// Shapes live on a 200×200 grid. Strokes come from the group; filled parts set stroke="none".
const SHAPES = {
  redirect: (
    <>
      <path d="M50 172 C46 96 92 62 158 64" fill="none" />
      <path d="M126 30 L162 64 L128 100" fill="none" />
    </>
  ),
  spark: (
    <>
      <path d="M92 22 L108 82 L170 98 L108 114 L92 176 L76 114 L16 98 L76 82Z" stroke="none" />
      <path d="M160 24 L166 44 L186 50 L166 56 L160 76 L154 56 L134 50 L154 44Z" stroke="none" />
    </>
  ),
  check: <path d="M34 106 L80 152 L168 52" fill="none" />,
  user: (
    <>
      <circle cx="100" cy="66" r="34" stroke="none" />
      <path d="M36 178 C36 136 64 114 100 114 C136 114 164 136 164 178 Z" stroke="none" />
    </>
  ),
  bolt: <path d="M114 14 L44 112 H96 L84 186 L156 86 H104 Z" stroke="none" />,
  team: (
    <>
      <circle cx="100" cy="62" r="28" stroke="none" />
      <path d="M50 170 C50 132 72 112 100 112 C128 112 150 132 150 170 Z" stroke="none" />
      <circle cx="44" cy="84" r="20" stroke="none" />
      <path d="M8 170 C8 142 22 126 44 126 C52 126 58 128 63 131 C52 142 46 156 46 170 Z" stroke="none" />
      <circle cx="156" cy="84" r="20" stroke="none" />
      <path d="M192 170 C192 142 178 126 156 126 C148 126 142 128 137 131 C148 142 154 156 154 170 Z" stroke="none" />
    </>
  ),
  alert: (
    <>
      <path d="M100 24 L182 170 H18 Z" fill="none" />
      <path d="M100 78 V114" fill="none" />
      <circle cx="100" cy="142" r="13" stroke="none" />
    </>
  ),
  shield: (
    <>
      <path d="M100 14 L174 42 V96 C174 142 142 176 100 190 C58 176 26 142 26 96 V42 Z" fill="none" />
      <path d="M68 102 L92 126 L136 78" fill="none" />
    </>
  ),
  link: (
    <g transform="rotate(-45 100 100)">
      <rect x="18" y="74" width="96" height="52" rx="26" fill="none" />
      <rect x="86" y="74" width="96" height="52" rx="26" fill="none" />
    </g>
  ),
  radar: (
    <>
      <circle cx="100" cy="100" r="76" fill="none" />
      <circle cx="100" cy="100" r="38" fill="none" />
      <path d="M100 100 L100 24 A76 76 0 0 1 166 62 Z" stroke="none" />
    </>
  ),
  gauge: (
    <>
      <path d="M26 138 A74 74 0 0 1 174 138" fill="none" />
      <path d="M100 138 L148 86" fill="none" />
      <circle cx="100" cy="138" r="16" stroke="none" />
    </>
  ),
  nodes: (
    <>
      <path d="M44 152 L100 52 L156 152 Z" fill="none" />
      <circle cx="44" cy="152" r="24" stroke="none" />
      <circle cx="100" cy="52" r="24" stroke="none" />
      <circle cx="156" cy="152" r="24" stroke="none" />
    </>
  ),
  bank: (
    <g stroke="none">
      <path d="M100 18 L184 66 L16 66Z" />
      <rect x="34" y="80" width="26" height="66" rx="4" />
      <rect x="87" y="80" width="26" height="66" rx="4" />
      <rect x="140" y="80" width="26" height="66" rx="4" />
      <rect x="16" y="158" width="168" height="24" rx="6" />
    </g>
  ),
  cap: (
    <>
      <path d="M100 32 L192 76 L100 120 L8 76Z" stroke="none" />
      <path d="M50 100 V140 Q100 174 150 140 V100" fill="none" />
    </>
  ),
  briefcase: (
    <>
      <rect x="18" y="66" width="164" height="110" rx="20" stroke="none" />
      <rect x="70" y="30" width="60" height="40" rx="12" fill="none" />
    </>
  ),
  cart: (
    <>
      <path d="M14 36 H46 L68 128 H158 L178 66 H58" fill="none" />
      <circle cx="84" cy="166" r="16" stroke="none" />
      <circle cx="146" cy="166" r="16" stroke="none" />
    </>
  ),
  dome: (
    <g stroke="none">
      <path d="M44 96 A56 56 0 0 1 156 96Z" />
      <rect x="94" y="20" width="12" height="26" rx="4" />
      <rect x="36" y="106" width="22" height="50" rx="4" />
      <rect x="76" y="106" width="22" height="50" rx="4" />
      <rect x="116" y="106" width="22" height="50" rx="4" />
      <rect x="148" y="106" width="16" height="50" rx="4" />
      <rect x="18" y="164" width="164" height="22" rx="6" />
    </g>
  ),
  card: (
    <>
      <rect x="16" y="44" width="168" height="112" rx="20" fill="none" />
      <rect x="16" y="72" width="168" height="28" stroke="none" />
    </>
  ),
  plus: <path d="M100 30 V170 M30 100 H170" fill="none" />,
  server: (
    <g stroke="none">
      <rect x="22" y="22" width="156" height="44" rx="12" />
      <rect x="22" y="78" width="156" height="44" rx="12" />
      <rect x="22" y="134" width="156" height="44" rx="12" />
    </g>
  ),
}

export default function ThermalIcon({ shape, size = 96, label }) {
  const uid = useId().replace(/:/g, '')
  const ref = useRef(null)

  // SMIL animation re-runs the filter every frame; only animate while on screen.
  useEffect(() => {
    const svg = ref.current
    if (!svg || !svg.pauseAnimations) return
    svg.pauseAnimations()
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? svg.unpauseAnimations() : svg.pauseAnimations()), {
      rootMargin: '120px',
    })
    io.observe(svg)
    return () => io.disconnect()
  }, [])

  const ids = { s: `${uid}-s`, sd: `${uid}-sd`, m: `${uid}-m`, c: `${uid}-c`, cd: `${uid}-cd` }
  const region = { x: '-40%', y: '-40%', width: '180%', height: '180%' }
  const stripe = (id, edge) => (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" x2="180" spreadMethod="repeat" gradientTransform="rotate(-35)">
      <stop stopColor={edge} />
      <stop offset=".5" stopColor="#000" />
      <stop offset="1" stopColor={edge} />
      <animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="180 0" dur="4.4s" repeatCount="indefinite" additive="sum" />
    </linearGradient>
  )

  return (
    <svg
      ref={ref}
      className="ticon"
      width={size}
      height={size}
      viewBox="-30 -30 260 260"
      overflow="visible"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{
        '--thermal-light': `url(#${ids.c})`,
        '--thermal-dark': `url(#${ids.cd})`,
        '--stripe-light': `url(#${ids.s})`,
        '--stripe-dark': `url(#${ids.sd})`,
      }}
    >
      <defs>
        {stripe(ids.s, '#6a6a6a')}
        {stripe(ids.sd, '#5a5a5a')}
        <filter id={ids.m} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="4" />
          <feComposite in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" />
          <feBlend in="SourceGraphic" mode="overlay" />
        </filter>
        <ColorFilter id={ids.c} paper="1" table={LIGHT_BLUE} {...region} />
        <ColorFilter id={ids.cd} paper="0.0706" table={DARK} {...region} />
      </defs>
      <g className="thermal__color">
        <g className="thermal__text ticon__ink" filter={`url(#${ids.m})`}>
          {SHAPES[shape]}
        </g>
      </g>
    </svg>
  )
}
