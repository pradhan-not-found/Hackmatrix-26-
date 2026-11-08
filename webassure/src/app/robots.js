export default function robots() {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/dashboard', '/api/', '/auth/', '/login', '/forgot-password'] }],
    sitemap: 'https://webassure.dev/sitemap.xml',
  }
}
