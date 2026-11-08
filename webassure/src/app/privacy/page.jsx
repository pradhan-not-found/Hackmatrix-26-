import Legal from '../../views/Legal.jsx'
import { JsonLd, breadcrumbs, pageMeta } from '../../lib/seo.jsx'

export const metadata = pageMeta({
  title: 'Privacy Policy',
  description: 'How WebAssure collects, uses and protects your information, which services process it, and the choices you have.',
  path: '/privacy',
})

const SECTIONS = [
  {
    id: 'overview',
    title: 'Overview',
    body: [
      'WebAssure helps you check links, websites and certificates before you trust them. This policy explains what information we handle when you use the website, the dashboard and the investigation service, why we handle it, and the choices you have.',
      'We collect the minimum needed to run a check and show you the result. We do not sell personal information.',
    ],
  },
  {
    id: 'data',
    title: 'Information we collect',
    body: [
      [
        'Account details: your name, email address and, optionally, a profile photo.',
        'Submitted content: the URLs, domains or messages you ask us to check, including any query strings they contain.',
        'Investigation reports: findings, evidence, certificate details, redirect chains and risk scores produced by a check.',
        'Technical data: basic request logs such as IP address, browser type and timestamps, used for security and reliability.',
      ],
    ],
  },
  {
    id: 'use',
    title: 'How we use information',
    body: [
      [
        'To run investigations and show you explained results.',
        'To keep your history of scans and reports available in your dashboard.',
        'To protect the service against abuse, fraud and attacks.',
        'With your agreement, to understand usage and improve WebAssure.',
      ],
    ],
  },
  {
    id: 'third-parties',
    title: 'Third-party services',
    body: [
      'Some checks rely on trusted providers. When enabled, a submitted URL may be sent to Google Safe Browsing for a reputation lookup. Optional AI explanations may send the hostname and selected findings, never full URL paths, query strings or raw headers, to Google Gemini.',
      'These providers process data under their own terms. We do not share your information with advertisers.',
    ],
  },
  {
    id: 'cookies',
    title: 'Cookies',
    body: [
      'Essential cookies and local storage keep you signed in and remember your preferences, such as theme. They are required for the service to work.',
      'Optional analytics cookies help us understand how WebAssure is used. They are only set if you choose “Accept all” in the cookie notice, and you can change your choice by clearing your browser storage.',
    ],
  },
  {
    id: 'retention',
    title: 'Data retention',
    body: [
      'Reports are kept for as long as your account is active so you can return to them. You can delete reports from your dashboard, and we delete account data when you close your account, except where we must keep limited records for legal or security reasons.',
    ],
  },
  {
    id: 'security',
    title: 'Security',
    body: [
      'Suspicious pages are inspected on our servers, never in your browser. Connections are encrypted, API keys are never included in reports, and access to stored data is restricted.',
      'If you believe you have found a security vulnerability, please report it to us privately through the dashboard rather than disclosing it publicly. We will acknowledge and investigate every responsible report.',
    ],
  },
  {
    id: 'rights',
    title: 'Your rights',
    body: [
      'Depending on where you live, you may have the right to access, correct, export or delete your personal information, and to object to or restrict certain processing. You can manage most of this from Settings in your dashboard, or ask us to help.',
    ],
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    body: [
      'We may update this policy as WebAssure evolves. When we make material changes we will update the date above and, where appropriate, notify you in the product.',
    ],
  },
]

export default function Page() {
  return (
    <>
      <JsonLd data={breadcrumbs([['Privacy Policy', '/privacy']])} />
      <Legal
      eyebrow="Legal"
      title="Privacy Policy"
      intro="Your trust is the product. Here is exactly what we collect, why, and how you stay in control."
      updated="November 8, 2026"
      sections={SECTIONS}
    />
    </>
  )
}
