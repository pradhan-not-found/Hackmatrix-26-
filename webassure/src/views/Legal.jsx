'use client'

import { useEffect, useRef, useState } from 'react'
import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'

export default function Legal({ eyebrow, title, intro, updated, sections }) {
  // Scroll-spy: the section whose heading has passed the top band is active.
  const [active, setActive] = useState(0)
  const [dotY, setDotY] = useState(0)
  const items = useRef([])
  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      let idx = 0
      sections.forEach((s, i) => {
        const el = document.getElementById(s.id)
        if (el && el.getBoundingClientRect().top <= 160) idx = i
      })
      // at the very bottom, the last section is active
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) idx = sections.length - 1
      setActive(idx)
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf) }
  }, [sections])
  useEffect(() => {
    const li = items.current[active]
    if (li) setDotY(li.offsetTop + li.offsetHeight / 2)
  }, [active])

  return (
    <>
      <Header />
      <main className="legal wrap">
        <header className="legal__head">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="legal__t">{title}</h1>
          <p className="legal__intro">{intro}</p>
          <p className="legal__meta">Last updated {updated}</p>
        </header>

        <div className="legal__body">
          <nav className="legal__toc" aria-label="On this page">
            <p className="legal__toc-t">On this page</p>
            <ol className="toc" style={{ '--dot-y': `${dotY}px` }}>
              <span className="toc__fill" aria-hidden="true" />
              <span className="toc__dot" aria-hidden="true" />
              {sections.map((s, i) => (
                <li key={s.id} ref={(el) => { items.current[i] = el }} data-state={i === active ? 'on' : i < active ? 'past' : undefined}>
                  <a
                    href={`#${s.id}`}
                    aria-current={i === active ? 'location' : undefined}
                    onClick={(e) => {
                      const el = document.getElementById(s.id)
                      if (!el) return
                      e.preventDefault()
                      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' })
                      history.replaceState(null, '', `#${s.id}`)
                    }}
                  >{s.title}</a>
                </li>
              ))}
            </ol>
          </nav>

          <article className="legal__content">
            {sections.map((s) => (
              <section key={s.id} id={s.id} className="legal__sec">
                <h2>{s.title}</h2>
                {s.body.map((block, i) =>
                  Array.isArray(block) ? (
                    <ul key={i}>{block.map((li) => <li key={li}>{li}</li>)}</ul>
                  ) : (
                    <p key={i}>{block}</p>
                  )
                )}
              </section>
            ))}
          </article>
        </div>
      </main>
      <Footer />
    </>
  )
}
