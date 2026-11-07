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

// Soft circular dent used as a pressure map on the glossy wordmark.
const PRESS =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><defs><radialGradient id="g">' +
      '<stop offset="0" stop-opacity="1"/><stop offset=".25" stop-opacity=".9"/><stop offset=".5" stop-opacity=".55"/>' +
      '<stop offset=".75" stop-opacity=".18"/><stop offset="1" stop-opacity="0"/>' +
      '</radialGradient></defs><circle cx="50" cy="50" r="50" fill="url(#g)"/></svg>'
  )

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

export default function Thermal({ text = 'webassure', className = '', tone, viewBox = '-40 -30 980 230' }) {
  const uid = useId().replace(/:/g, '')
  const svgRef = useRef(null)
  const pressRef = useRef(null)
  const depthRef = useRef(null)

  // Pressing the plastic: dent depth and size are proportional to pressure.
  // Hover = light touch; holding the button presses deeper over time; pen/touch
  // use real pressure. On release the surface springs back with a little rebound.
  useEffect(() => {
    const svg = svgRef.current
    const img = pressRef.current
    const depthFn = depthRef.current
    if (!svg || !img || !depthFn) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const host = svg.parentElement
    const HOVER = 0.3
    let raf = 0
    let hovering = false
    let down = false
    let downAt = 0
    let penPressure = 0
    const pos = { x: 450, y: 100, tx: 450, ty: 100 }
    let depth = 0
    let vel = 0
    const targetDepth = (now) => {
      if (down) {
        if (penPressure > 0) return Math.min(1, 0.25 + penPressure * 0.85)
        return Math.min(1, 0.45 + ((now - downAt) / 1000) * 0.9) // deeper the longer you hold
      }
      return hovering ? HOVER : 0
    }
    const tick = (now) => {
      pos.x += (pos.tx - pos.x) * 0.25
      pos.y += (pos.ty - pos.y) * 0.25
      // spring toward the target depth (rebounds slightly when released)
      vel += (targetDepth(now) - depth) * 0.16
      vel *= 0.74
      depth = Math.max(0, depth + vel)
      const R = 56 + 44 * Math.min(1, depth) // wider footprint under more pressure
      img.setAttribute('x', (pos.x - R).toFixed(1))
      img.setAttribute('y', (pos.y - R).toFixed(1))
      img.setAttribute('width', (R * 2).toFixed(1))
      img.setAttribute('height', (R * 2).toFixed(1))
      depthFn.setAttribute('slope', depth.toFixed(3))
      const settled = !down && Math.abs(vel) < 0.001 && Math.abs(targetDepth(now) - depth) < 0.002 &&
        Math.abs(pos.tx - pos.x) < 0.2 && Math.abs(pos.ty - pos.y) < 0.2
      raf = settled ? 0 : requestAnimationFrame(tick)
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick) }
    const toLocal = (e) => {
      const m = svg.getScreenCTM()
      if (!m) return null
      return new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    }
    const onMove = (e) => {
      const pt = toLocal(e)
      if (!pt) return
      if (!hovering && depth < 0.01) { pos.x = pt.x; pos.y = pt.y }
      pos.tx = pt.x
      pos.ty = pt.y
      hovering = true
      if (down && e.pointerType !== 'mouse') penPressure = e.pressure || 0
      kick()
    }
    const onDown = (e) => {
      down = true
      downAt = performance.now()
      penPressure = e.pointerType !== 'mouse' ? e.pressure || 0 : 0
      onMove(e)
    }
    const onUp = () => { down = false; penPressure = 0; kick() }
    const onLeave = () => { hovering = false; down = false; penPressure = 0; kick() }
    host.addEventListener('pointermove', onMove)
    host.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    host.addEventListener('pointerleave', onLeave)
    return () => {
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      host.removeEventListener('pointerleave', onLeave)
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
      viewBox={viewBox}
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
          {tone === 'white' ? (
            <>
              <stop offset="0" stopColor="#c9ceda" />
              <stop offset=".35" stopColor="#f4f6fb" />
              <stop offset=".6" stopColor="#ffffff" />
              <stop offset="1" stopColor="#d6dbe6" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#1b3bd1" />
              <stop offset=".35" stopColor="#3f6dff" />
              <stop offset=".6" stopColor="#7ab8ff" />
              <stop offset="1" stopColor="#2a4fe6" />
            </>
          )}
          <animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="1800 0" dur="9s" repeatCount="indefinite" />
        </linearGradient>
        <filter id={`${uid}-glass`} x="-10%" y="-40%" width="120%" height="190%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="b" />
          <feImage
            ref={pressRef}
            href={PRESS}
            x="-999"
            y="-999"
            width="140"
            height="140"
            preserveAspectRatio="none"
            result="pressRaw"
          />
          <feComponentTransfer in="pressRaw" result="press">
            <feFuncA ref={depthRef} type="linear" slope="0" />
          </feComponentTransfer>
          <feComposite in="b" in2="press" operator="arithmetic" k1="0" k2="1" k3="1.25" k4="0" result="h" />
          <feSpecularLighting in="h" surfaceScale="5.5" specularConstant="1.1" specularExponent="24" lightingColor="#ffffff" result="spec">
            <feDistantLight azimuth="240" elevation="52" />
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn" />
          <feComposite in="SourceGraphic" in2="specIn" operator="arithmetic" k1="0" k2="1" k3="0.8" k4="0" result="litRaw" />
          {/* diffuse shading from the same height map: the bump's far side falls into shadow */}
          <feDiffuseLighting in="h" surfaceScale="5.5" diffuseConstant="1" lightingColor="#ffffff" result="diff">
            <feDistantLight azimuth="240" elevation="52" />
          </feDiffuseLighting>
          <feComposite in="litRaw" in2="diff" operator="arithmetic" k1="0.62" k2="0.52" k3="0" k4="0" result="litShaded" />
          <feComposite in="litShaded" in2="SourceAlpha" operator="in" result="lit" />
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="ib" />
          <feOffset in="ib" dy="-3" result="io" />
          <feComposite in="SourceAlpha" in2="io" operator="out" result="inner" />
          <feFlood floodColor={tone === 'white' ? '#5b6275' : '#0b1a6b'} floodOpacity={tone === 'white' ? '.45' : '.55'} />
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
          {text}
        </text>
      </g>
    </svg>
  )
}
