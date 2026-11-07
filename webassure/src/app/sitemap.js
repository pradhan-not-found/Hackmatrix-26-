const SITE = 'https://webassure.dev'

export default function sitemap() {
  const now = new Date()
  return [
    { url: `${SITE}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/signup`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
  ]
}
