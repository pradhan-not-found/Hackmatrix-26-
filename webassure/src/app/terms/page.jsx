import Legal from '../../views/Legal.jsx'

export const metadata = {
  title: 'Terms of Service',
  description: 'The terms that apply when you use WebAssure.',
  alternates: { canonical: '/terms' },
}

const SECTIONS = [
  {
    id: 'agreement',
    title: 'Agreement',
    body: [
      'By creating an account or using WebAssure you agree to these terms. If you use WebAssure on behalf of an organisation, you confirm you are authorised to accept them for it.',
    ],
  },
  {
    id: 'service',
    title: 'The service',
    body: [
      'WebAssure analyses links, websites and certificates and gives an evidence-based risk assessment. Results are guidance to help you decide; they are not a guarantee that a site is safe or unsafe.',
    ],
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    body: [
      [
        'Only submit content you are allowed to share.',
        'Do not use WebAssure to attack, overload or probe systems you do not own or have permission to test.',
        'Do not attempt to bypass limits, reverse engineer the service or misuse the API.',
        'Do not submit false reports to the threat ledger.',
      ],
    ],
  },
  {
    id: 'accounts',
    title: 'Accounts and plans',
    body: [
      'You are responsible for keeping your login and API keys secure. Paid plans renew automatically until cancelled and can be cancelled at any time; access continues until the end of the billing period.',
    ],
  },
  {
    id: 'liability',
    title: 'Disclaimer and liability',
    body: [
      'WebAssure is provided “as is”. To the extent permitted by law, we are not liable for losses resulting from decisions made using the service, including visiting or avoiding a website.',
    ],
  },
  {
    id: 'changes',
    title: 'Changes',
    body: [
      'We may update these terms. Continued use after an update means you accept the revised terms. See also our Privacy Policy for how we handle data.',
    ],
  },
]

export default function Page() {
  return (
    <Legal
      eyebrow="Legal"
      title="Terms of Service"
      intro="The plain-language rules for using WebAssure."
      updated="November 8, 2026"
      sections={SECTIONS}
    />
  )
}
