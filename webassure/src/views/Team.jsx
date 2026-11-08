'use client'

import Image from 'next/image'
import Header from '../components/Header.jsx'
import Footer from '../components/Footer.jsx'
import { PersonPlaceholder } from '../components/Icons.jsx'

// Replace the `#` links and add `photo: '/team/<file>.jpg'` when ready.
const TEAM = [
  { name: 'Souradeep Pradhan', photo: '/team/souradeep.png', bright: 1.12, github: '#', website: '#', linkedin: '#' },
  { name: 'Madhushree Dasgupta', photo: '/team/madhushree.png', zoom: 1.06, pos: 'center 28%', github: 'https://github.com/madhushree-cyber', website: '#', linkedin: 'https://www.linkedin.com/in/madhushree-dasgupta-4b8a79389' },
  { name: 'Aniruddha Das', org: 'Adamas University', photo: '/team/aniruddha.png', zoom: 1.08, pos: 'center 22%', github: '#', website: '#', linkedin: '#' },
  { name: 'Sattwik Das', photo: '/team/sattwik.png', github: 'https://github.com/Sattwik-Das', website: 'https://sattwik-das.vercel.app/', linkedin: 'https://www.linkedin.com/in/sattwik-das-in' },
]

const Icon = {
  github: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.2c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5z" />
    </svg>
  ),
  website: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.75h4v11H3v-11zm6.5 0h3.8v1.5h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1v5.45h-4v-4.83c0-1.15-.02-2.63-1.6-2.63-1.6 0-1.85 1.25-1.85 2.55v4.91h-4v-11z" />
    </svg>
  ),
}

export default function Team() {
  return (
    <>
      <Header />
      <main className="team wrap">
        <header className="team__head">
          <p className="eyebrow">The team</p>
          <h1 className="team__t">
            Fantastic <span className="team__four">4</span>
          </h1>
          <p className="team__d">The four people building WebAssure.</p>
        </header>

        <ul className="team__grid">
          {TEAM.map((m) => (
            <li key={m.name} className="member">
              <span className="member__photo">
                {m.photo ? (
                  <Image src={m.photo} alt={m.name} fill sizes="(max-width: 520px) 92vw, (max-width: 1023px) 46vw, 300px" className="member__img" style={{ ...(m.zoom && { transform: `scale(${m.zoom})`, objectPosition: m.pos }), ...(m.bright && { filter: `grayscale(1) contrast(1.06) brightness(${m.bright})` }) }} />
                ) : (
                  <PersonPlaceholder />
                )}
              </span>
              <div className="member__info">
                <h2 className="member__name">{m.name}</h2>
                <p className="member__role">{m.org || 'Fantastic 4'}</p>
              </div>
              <div className="member__links">
                {[
                  ['github', 'GitHub'],
                  ['website', 'Website'],
                  ['linkedin', 'LinkedIn'],
                ].map(([k, label]) => (
                  <a key={k} href={m[k]} className="member__link" aria-label={`${m.name} on ${label}`} {...(m[k] !== "#" && { target: "_blank", rel: "noopener noreferrer" })}>
                    {Icon[k]}
                  </a>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </>
  )
}
