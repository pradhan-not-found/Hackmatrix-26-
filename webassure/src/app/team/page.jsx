import Team from '../../views/Team.jsx'
import { TEAM } from '../../lib/content.js'
import { JsonLd, NAME, SITE, breadcrumbs, pageMeta } from '../../lib/seo.jsx'

export const metadata = pageMeta({
  title: 'Team',
  description: 'Meet Fantastic 4, the team building WebAssure: AI threat detection for links, websites and certificates.',
  path: '/team',
})

const people = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  name: 'The WebAssure team',
  url: `${SITE}/team`,
  about: { '@type': 'Organization', name: NAME, url: SITE },
  mainEntity: TEAM.map((m) => ({
    '@type': 'Person',
    name: m.name,
    ...(m.photo && { image: `${SITE}${m.photo}` }),
    ...(m.org && { affiliation: { '@type': 'Organization', name: m.org } }),
    sameAs: [m.github, m.website, m.linkedin].filter((u) => u && u !== '#'),
  })),
}

export default function Page() {
  return <><JsonLd data={[people, breadcrumbs([['Team', '/team']])]} /><Team /></>
}
