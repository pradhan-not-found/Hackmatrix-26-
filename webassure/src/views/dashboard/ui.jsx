'use client'

import { useMemo, useState } from 'react'

export function PageHead({ title, sub, children }) {
  return (
    <div className="ph">
      <div>
        <h1 className="dash__title">{title}</h1>
        {sub && <p className="caption grey">{sub}</p>}
      </div>
      {children && <div className="ph__actions">{children}</div>}
    </div>
  )
}

export function Tabs({ value, onChange, options }) {
  return (
    <div className="tabs" role="tablist">
      {options.map(([key, label, count]) => (
        <button key={key} role="tab" aria-selected={value === key} onClick={() => onChange(key)}>
          {label}
          {count !== undefined && <span className="tabs__n">{count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Kpi({ label, value, delta }) {
  return (
    <div className="card kpi">
      <p className="caption grey">{label}</p>
      <p className="kpi__v">{value}</p>
      {delta && <p className="caption grey">{delta}</p>}
    </div>
  )
}

export function Empty({ title, text }) {
  return (
    <div className="empty">
      <p className="empty__t">{title}</p>
      <p className="caption grey">{text}</p>
    </div>
  )
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button className="switch" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}>
      <span />
    </button>
  )
}

/* Single-series line chart with crosshair + tooltip */
export function TrendChart({ labels, values, unit = 'scans' }) {
  const [hover, setHover] = useState(null)
  const W = 640
  const H = 240
  const P = { t: 16, r: 12, b: 28, l: 40 }
  // Nice scale that works for 0, small counts and large counts.
  const top = Math.max(0, ...values)
  const max = top <= 4 ? 4 : top <= 100 ? Math.ceil(top / 4) * 4 : Math.ceil(top / 100) * 100
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max]
  const x = (i) => P.l + (i * (W - P.l - P.r)) / (values.length - 1)
  const y = (v) => P.t + (1 - v / max) * (H - P.t - P.b)
  const path = useMemo(() => values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' '), [values])
  const area = `${path} L${x(values.length - 1)},${y(0)} L${x(0)},${y(0)} Z`

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const i = Math.round(((px - P.l) / (W - P.l - P.r)) * (values.length - 1))
    setHover(Math.max(0, Math.min(values.length - 1, i)))
  }

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label="Scans per day">
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--chart)" stopOpacity="0.16" />
            <stop offset="1" stopColor="var(--chart)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={P.l - 8} y={y(t) + 4} textAnchor="end" className="chart__tick">{t}</text>
          </g>
        ))}
        {labels.map((l, i) => (i % 3 === 0 || i === labels.length - 1) && (
          <text key={l} x={x(i)} y={H - 8} textAnchor="middle" className="chart__tick">{l}</text>
        ))}
        <path d={area} fill="url(#chart-fill)" />
        <path d={path} fill="none" stroke="var(--chart)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke="var(--grey)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(values[hover])} r="5" fill="var(--chart)" stroke="var(--card)" strokeWidth="2" />
          </g>
        )}
        <rect x={P.l} y={P.t} width={W - P.l - P.r} height={H - P.t - P.b} fill="transparent" />
      </svg>
      {hover !== null && (
        <div className="chart__tip" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(values[hover]) / H) * 100}%` }}>
          <span className="caption grey">{labels[hover]}</span>
          <strong>{values[hover]} {unit}</strong>
        </div>
      )}
      <table className="skip">
        <caption>Scans per day</caption>
        <tbody>{labels.map((l, i) => <tr key={l}><th>{l}</th><td>{values[i]}</td></tr>)}</tbody>
      </table>
    </div>
  )
}

/* Single-hue horizontal bars, direct-labelled */
export function Bars({ data }) {
  const max = Math.max(1, ...data.map(([, v]) => v))
  const total = Math.max(1, data.reduce((a, [, v]) => a + v, 0))
  return (
    <ul className="bars">
      {data.map(([label, v]) => (
        <li key={label} className="bars__row" title={`${label}: ${v} (${Math.round((v / total) * 100)}%)`}>
          <div className="bars__meta">
            <span>{label}</span>
            <span className="grey">{v}</span>
          </div>
          <span className="bars__track">
            <span className="bars__fill" style={{ width: `${(v / max) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  )
}
