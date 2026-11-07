import { Archivo, Hanken_Grotesk, Inter, Outfit } from 'next/font/google'
import ThemeProvider, { themeScript } from '../components/ThemeProvider.jsx'
import '../styles/styles.css'
import '../styles/app.css'
import '../styles/pages.css'
import '../styles/sections.css'
import '../styles/landing2.css'
import '../styles/dashboard.css'
import '../styles/polish.css'

const hanken = Hanken_Grotesk({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-hanken', display: 'swap' })
const outfit = Outfit({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-outfit', display: 'swap' })
const inter = Inter({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-inter', display: 'swap' })
const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-archivo', display: 'swap' })

const SITE = 'https://webassure.dev'
const TITLE = 'WebAssure — Know your website before you trust it'
const DESCRIPTION =
  'WebAssure is an AI security platform that detects phishing sites, fake portals, payment scams and forged TLS certificates, and explains every risk in plain language.'

export const metadata = {
  metadataBase: new URL(SITE),
  title: { default: TITLE, template: '%s · WebAssure' },
  description: DESCRIPTION,
  applicationName: 'WebAssure',
  keywords: [
    'phishing detection', 'scam checker', 'URL checker', 'website safety', 'TLS certificate check',
    'certificate transparency', 'brand impersonation', 'threat intelligence',
  ],
  authors: [{ name: 'WebAssure' }],
  alternates: { canonical: '/' },
  manifest: '/site.webmanifest',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }, { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    siteName: 'WebAssure',
    url: SITE,
    title: TITLE,
    description: 'AI threat detection for links, websites and certificates. Get an explained risk score in seconds.',
    locale: 'en_IN',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'WebAssure — Know your website, trust every link, click with confidence.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: 'AI threat detection for links, websites and certificates. Get an explained risk score in seconds.',
    images: ['/og-image.png'],
  },
  robots: { index: true, follow: true },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#121212' },
  ],
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'WebAssure',
  applicationCategory: 'SecurityApplication',
  operatingSystem: 'Web',
  url: SITE,
  description: DESCRIPTION,
  offers: [
    { '@type': 'Offer', name: 'Personal', price: '0', priceCurrency: 'INR' },
    { '@type': 'Offer', name: 'Pro', price: '499', priceCurrency: 'INR' },
    { '@type': 'Offer', name: 'Teams', price: '2499', priceCurrency: 'INR' },
  ],
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${hanken.variable} ${outfit.variable} ${archivo.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
