// Shared content used by components and by page metadata / structured data.

export const FAQS = [
  ['What can I submit?', 'Any URL, domain, email or message. WebAssure extracts the links and checks each one.'],
  ['Do I have to open the suspicious site?', 'No. Pages are fetched in an isolated sandbox on our side, so nothing runs on your device.'],
  ['How is the risk score calculated?', 'Four engines (AI content analysis, certificate validation, site-security scanning and reputation data) each contribute weighted indicators. The report shows every one.'],
  ['How does the on-chain threat ledger work?', 'Every confirmed threat is hashed and committed on-chain, creating a tamper-proof, publicly verifiable record. No one, including us, can quietly edit or delete a report, and anyone can check it against the ledger without trusting WebAssure.'],
  ['Is there an API?', 'Yes. Security teams can submit URLs and pull reports programmatically from the dashboard.'],
]

export const TEAM = [
  { name: 'Souradeep Pradhan', photo: '/team/souradeep.png', bright: 1.12, github: '#', website: '#', linkedin: '#' },
  { name: 'Madhushree Dasgupta', photo: '/team/madhushree.png', zoom: 1.06, pos: 'center 28%', github: 'https://github.com/madhushree-cyber', website: '#', linkedin: 'https://www.linkedin.com/in/madhushree-dasgupta-4b8a79389' },
  { name: 'Aniruddha Das', org: 'Adamas University', photo: '/team/aniruddha.png', zoom: 1.08, pos: 'center 22%', github: '#', website: '#', linkedin: '#' },
  { name: 'Sattwik Das', photo: '/team/sattwik.png', github: 'https://github.com/Sattwik-Das', website: 'https://sattwik-das.vercel.app/', linkedin: 'https://www.linkedin.com/in/sattwik-das-in' },
]
