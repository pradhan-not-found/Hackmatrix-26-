export default function robots() {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: '/dashboard' }],
    sitemap: 'https://webassure.dev/sitemap.xml',
  }
}
