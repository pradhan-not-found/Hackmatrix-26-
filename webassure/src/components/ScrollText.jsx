'use client'

import { useEffect, useRef, useState } from 'react'

// Statement whose second part fills from grey to ink as it scrolls through the viewport.
export default function ScrollText({ lead, rest, as: Tag = 'h2', className = '' }) {
  const ref = useRef(null)
  const words = rest.split(' ')
  const [p, setP] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setP(1)
      return
    }
    let raf = 0
    const update = () => {
      raf = 0
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      const start = vh * 0.85
      const end = vh * 0.35
      setP(Math.min(1, Math.max(0, (start - r.top) / (start - end + r.height * 0.5))))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  const lit = Math.round(p * words.length)
  return (
    <Tag ref={ref} className={`scroll-text ${className}`}>
      <span className="scroll-text__lead">{lead}</span>{' '}
      {words.map((w, i) => (
        <span key={i} className="scroll-text__w" data-lit={i < lit || undefined}>
          {w}{' '}
        </span>
      ))}
    </Tag>
  )
}
