'use client'

import { useId } from 'react'

// Heat-map wordmark: the text is filled with a moving black/white stripe, blurred,
// and the resulting luminance is remapped through a thermal colour table.
const R = '0 0 0 1 1 .953'
const G = '0 .0863 .6667 .7961 .2667 .5176'
const B = '0 .4275 1 .3608 0 1'

// Dark mode: electric glow — white core → cyan → blue → violet rim → page.
export const DARK = {
  R: '1 .78 .3 .23 .42 .1',
  G: '1 .94 .79 .42 .24 .07',
  B: '1 1 1 1 1 .25',
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
  const stripe = `${uid}-stripe`
  const material = `${uid}-material`
  const color = `${uid}-color`
  const colorDark = `${uid}-color-dark`

  return (
    <svg
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
          <stop stopColor="#fff" />
          <stop offset=".5" stopColor="#000" />
          <stop offset="1" stopColor="#fff" />
          <animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="486 0" dur="4.4s" repeatCount="indefinite" additive="sum" />
        </linearGradient>
        {/* Dark mode: a shallower stripe keeps every letter in the blue/orange core
            instead of drifting into pink haze against the dark page. */}
        <linearGradient id={`${stripe}-dark`} gradientUnits="userSpaceOnUse" x2="486" spreadMethod="repeat" gradientTransform="rotate(-35)">
          <stop stopColor="#5a5a5a" />
          <stop offset=".5" stopColor="#000" />
          <stop offset="1" stopColor="#5a5a5a" />
          <animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="486 0" dur="4.4s" repeatCount="indefinite" additive="sum" />
        </linearGradient>
        <filter id={material} x="-3%" y="-15%" width="106%" height="130%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="4.5" />
          <feComposite in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" />
          <feBlend in="SourceGraphic" mode="overlay" />
        </filter>
        <ColorFilter id={color} paper="1" />
        <ColorFilter id={colorDark} paper="0.0706" table={tone === 'white' ? WHITE : DARK} />
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
    </svg>
  )
}
