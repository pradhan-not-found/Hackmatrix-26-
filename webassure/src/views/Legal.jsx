'use client'

import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'

export default function Legal({ eyebrow, title, intro, updated, sections }) {
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
            <ol>
              {sections.map((s) => (
                <li key={s.id}><a href={`#${s.id}`}>{s.title}</a></li>
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
