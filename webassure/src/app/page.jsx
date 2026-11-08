import Landing from '../views/Landing.jsx'
import { FAQS } from '../lib/content.js'
import { JsonLd, faqPage, organization, pageMeta, website } from '../lib/seo.jsx'

export const metadata = pageMeta({
  title: 'WebAssure — Know your website before you trust it',
  absoluteTitle: true,
  description: 'Check any link, website or certificate in seconds. WebAssure detects phishing sites, fake portals, payment scams and forged TLS certificates, and explains every risk in plain language.',
  path: '/',
})

export default function Page() {
  return (
    <>
      <JsonLd data={[organization, website, faqPage(FAQS)]} />
      <Landing />
    </>
  )
}
