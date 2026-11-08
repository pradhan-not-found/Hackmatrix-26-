// SEO helpers shared by every page: consistent titles, canonical URLs,
// social previews and structured data (schema.org JSON-LD).

export const SITE = 'https://webassure.dev'
export const NAME = 'WebAssure'
const OG_IMAGE = { url: '/og-image.png', width: 1200, height: 630, alt: 'WebAssure: know your website before you trust it.' }

/** Metadata for a page: title, description, canonical, Open Graph and Twitter. */
export function pageMeta({ title, description, path = '/', noindex = false, absoluteTitle = false }) {
  const full = absoluteTitle ? title : `${title} · ${NAME}`
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', siteName: NAME, locale: 'en_IN', url: `${SITE}${path}`, title: full, description, images: [OG_IMAGE] },
    twitter: { card: 'summary_large_image', title: full, description, images: [OG_IMAGE.url] },
    ...(noindex && { robots: { index: false, follow: true } }),
  }
}

/** Breadcrumb trail from the home page, e.g. breadcrumbs([['Team', '/team']]). */
export function breadcrumbs(trail) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [['Home', '/'], ...trail].map(([name, path], i) => ({
      '@type': 'ListItem', position: i + 1, name, item: `${SITE}${path}`,
    })),
  }
}

export const organization = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: NAME,
  url: SITE,
  logo: `${SITE}/icon-512.png`,
  description: 'AI security platform that detects phishing sites, fake portals, payment scams and forged TLS certificates.',
}

export const website = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: NAME,
  url: SITE,
  inLanguage: 'en-IN',
}

export function faqPage(faqs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  }
}

/** Renders one or more JSON-LD blocks. */
export function JsonLd({ data }) {
  const list = Array.isArray(data) ? data : [data]
  return list.map((d, i) => (
    <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d).replace(/</g, '\u003c') }} />
  ))
}
