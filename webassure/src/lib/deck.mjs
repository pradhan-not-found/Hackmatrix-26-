// Pitch deck content. One layout model drives the preview, the PPTX and the PDF.
// Coordinates are pixels on a 1280 x 720 slide.

export const W = 1280
export const H = 720

export const THEMES = {
  dark: {
    label: 'Black', bg: '121212', tile: '1C1C1C', console: '262626', line: '333333', laptop: '2A2A2A', base: '3A3A3A',
    ink: 'F1F1F1', grey: '8A8A8A', pill: 'F1F1F1', pillText: '121212', pillLine: null,
  },
  light: {
    label: 'White', bg: 'FFFFFF', tile: 'F3F3F3', console: 'E7E7E7', line: 'DDDDDD', laptop: 'D4D4D4', base: 'BDBDBD',
    ink: '171717', grey: '6F6F6F', pill: 'FFFFFF', pillText: '171717', pillLine: 'CFCFCF',
  },
}

const M = 72

export function buildSlides(mode) {
  const C = THEMES[mode]
  const asset = (path) => `/deck/${mode}/${path}`
  const text = (x, y, w, h, value, o = {}) => ({ type: 'text', x, y, w, h, value, size: 20, lh: 1.4, color: C.ink, ...o })
  const box = (x, y, w, h, o = {}) => ({ type: 'rect', x, y, w, h, fill: C.tile, radius: 12, ...o })
  const img = (src, alt, x, y, w, h) => ({ type: 'image', src, alt, x, y, w, h })
  const icon = (name, x, y, size) => img(asset(`icons/${name}.png`), name, x, y, size, size)
  const logo = (name, x, y, size) => img(asset(`tech/${name}.png`), name, x, y, size, size)
  const arrow = (x1, y1, x2, y2) => ({ type: 'arrow', x1, y1, x2, y2, color: C.grey })

  const eyebrow = (value, y = 76, x = M) => text(x, y, 700, 26, value, { size: 18, color: C.grey })
  const title = (value, y = 104, w = 1136) => text(M, y, w, 64, value, { size: 46, lh: 1.15, weight: 600, ls: -0.03 })

  const footer = (source) => [
    text(M, 672, 300, 20, [{ t: 'webassure', b: true }, { t: '  |  HackMatrix 2026', c: C.grey }], { size: 13, lh: 1.3 }),
    ...(source ? [text(372, 672, 836, 20, source, { size: 12, lh: 1.3, color: C.grey, align: 'right' })] : []),
  ]

  const techTile = (x, y, name, label) => [
    box(x, y, 112, 74, { fill: C.console, radius: 10 }),
    ...(name ? [logo(name, x + 42, y + 11, 28)] : []),
    text(x + 4, name ? y + 48 : y + 28, 104, 18, label, { size: 12, lh: 1.3, weight: 600, align: 'center' }),
  ]

  const stackBox = (x, y, h, heading, tiles) => [
    box(x, y, 280, h),
    text(x, y + 14, 280, 28, heading, { size: 20, lh: 1.3, weight: 600, align: 'center', ls: -0.01 }),
    ...tiles.flatMap(([name, label], i) => techTile(x + 22 + (i % 2) * 124, y + 52 + Math.floor(i / 2) * 84, name, label)),
  ]

  const storyCard = (y, name, heading, body) => [
    box(640, y, 568, 104),
    icon(name, 664, y + 20, 30),
    text(712, y + 18, 472, 28, heading, { size: 20, lh: 1.3, weight: 600, ls: -0.01 }),
    text(712, y + 48, 472, 48, body, { size: 16, lh: 1.35, color: C.grey }),
  ]

  const statCard = (x, value, body) => [
    box(x, 372, 350, 200),
    text(x + 26, 398, 300, 62, value, { size: 46, lh: 1.15, weight: 600, ls: -0.03 }),
    text(x + 26, 470, 302, 84, body, { size: 18, lh: 1.4, color: C.grey }),
  ]

  const member = (x, file, name) => [
    box(x, 188, 266, 404),
    img(asset(`team/${file}.png`), name, x + 20, 208, 226, 282),
    text(x + 20, 510, 226, 30, name, { size: 20, lh: 1.3, weight: 600, ls: -0.01 }),
    text(x + 20, 542, 226, 24, 'Fantastic 4', { size: 15, lh: 1.3, color: C.grey }),
  ]

  const smallCard = (x, y, name, value) => [
    box(x, y, 214, 96),
    icon(name, x + 16, y + 20, 26),
    text(x + 54, y + 18, 150, 62, value, { size: 15, lh: 1.35 }),
  ]

  // Numbered demo steps; the sign-in step also shows the Google logo.
  const demoTab = (y, n, value, google) => [
    box(M, y, 416, 62),
    box(M + 14, y + 17, 28, 28, { fill: C.console, radius: 14 }),
    text(M + 14, y + 22, 28, 18, n, { size: 13, lh: 1.3, weight: 600, align: 'center' }),
    ...(google ? [img('/deck/google-color.png', 'Google', M + 56, y + 20, 22, 22)] : []),
    text(M + (google ? 90 : 56), y + 18, 300, 26, value, { size: 17, lh: 1.3 }),
  ]

  // Two-by-two card grid shared by Impact and Next steps.
  const gridCard = (x, y, name, heading, body, status) => [
    box(x, y, 376, 230),
    icon(name, x + 26, y + 26, 32),
    ...(status ? [
      box(x + 266, y + 28, 86, 28, { fill: C.console, radius: 14 }),
      text(x + 266, y + 34, 86, 18, status, { size: 12, lh: 1.3, weight: 600, align: 'center', color: C.grey }),
    ] : []),
    text(x + 26, y + 80, 324, 38, heading, { size: 26, lh: 1.2, weight: 600, ls: -0.02 }),
    text(x + 26, y + 124, 324, 90, body, { size: 17, lh: 1.45, color: C.grey }),
  ]

  const row = (x, y, w, art, heading, sub) => [
    box(x, y, w, 58, { fill: C.console, radius: 8 }),
    art(x + 14, y + 16, 26),
    text(x + 52, y + 10, w - 62, 20, heading, { size: 15, lh: 1.3, weight: 600 }),
    text(x + 52, y + 31, w - 62, 18, sub, { size: 12, lh: 1.3, color: C.grey }),
  ]
  const useLogo = (name) => (x, y, s) => logo(name, x, y, s)
  const useIcon = (name) => (x, y, s) => icon(name, x, y, s)

  const panel = (x, heading, rows) => [
    box(x, 176, 340, 320),
    text(x + 20, 192, 300, 28, heading, { size: 18, lh: 1.3, weight: 600, ls: -0.01 }),
    ...rows.flatMap(([art, a, b], i) => row(x + 14, 232 + i * 66, 312, art, a, b)),
  ]

  const chainStep = (x, art, heading, body) => [
    box(x, 190, 257, 210),
    art(x + 24, 214, 32),
    text(x + 24, 262, 212, 32, heading, { size: 22, lh: 1.25, weight: 600, ls: -0.02 }),
    text(x + 24, 298, 212, 90, body, { size: 16, lh: 1.42, color: C.grey }),
  ]

  const factCard = (x, heading, body) => [
    box(x, 424, 368, 150),
    text(x + 24, 446, 320, 28, heading, { size: 20, lh: 1.3, weight: 600, ls: -0.01 }),
    text(x + 24, 482, 320, 76, body, { size: 17, lh: 1.42, color: C.grey }),
  ]

  const coverLogo = (name, alt, x, h, ratio) => img(asset(`logos/${name}.png`), alt, x, 76 - h / 2, h * ratio, h)

  const slides = [
    {
      name: 'Cover',
      cover: true,
      items: [
        { type: 'shield', x: 148, y: 272, size: 296, color: C.ink },
        { type: 'wordmark', x: 540, y: 278, size: 104, color: C.ink },
        text(544, 418, 640, 44, 'Know your website before you trust it.', { size: 30, lh: 1.3, ls: -0.02 }),
        text(544, 486, 640, 34, 'HackMatrix 2026', { size: 24, lh: 1.3, weight: 600, ls: -0.015 }),
        text(544, 522, 640, 26, 'AI-Powered Web Threat Detection and Digital Trust Intelligence', { size: 17, lh: 1.3, color: C.grey }),
        coverLogo('hackmatrix', 'HackMatrix', 148, 36, 6.634),
        coverLogo('acm', 'ACM', 477, 64, 1),
        coverLogo('mlh', 'Major League Hacking', 631, 58, 2.372),
        coverLogo('adamas', 'Adamas University', 859, 70, 1.143),
        coverLogo('rice', 'RICE Adamas Group', 1029, 56, 1.852),
      ],
    },
    {
      name: 'Made by',
      items: [
        eyebrow('Made by'),
        title('Team Fantastic 4'),
        ...member(72, 'souradeep', 'Souradeep Pradhan'),
        ...member(362, 'madhushree', 'Madhushree Dasgupta'),
        ...member(652, 'aniruddha', 'Aniruddha Das'),
        ...member(942, 'sattwik', 'Sattwik Das'),
        ...footer(),
      ],
    },
    {
      name: 'The story',
      items: [
        eyebrow('A real case, 2024', 138),
        text(M, 166, 540, 112, '₹7.29 lakh', { size: 88, lh: 1.15, weight: 600, ls: -0.04 }),
        text(M, 286, 500, 90, 'lost by an IIT Bombay student to a “digital arrest” scam.', { size: 30, lh: 1.3, ls: -0.02 }),
        text(M, 384, 490, 70, 'He realised it was a scam only after searching online about digital arrest.', { size: 20, lh: 1.5, color: C.grey }),
        box(M, 470, 520, 86),
        text(92, 482, 480, 18, 'Overview', { size: 13, lh: 1.3, weight: 600, color: C.grey }),
        text(92, 503, 480, 44, 'Scammers impersonate officials, isolate the victim and pressure them into paying before they can check.', { size: 16, lh: 1.35 }),
        ...storyCard(104, 'phone', 'The call', 'A caller claiming to be from TRAI said 17 complaints were registered against his number.'),
        ...storyCard(220, 'video', 'The pressure', 'On a WhatsApp video call, a man dressed as a police officer accused him of money laundering.'),
        ...storyCard(336, 'user-x', 'The isolation', 'He was told he was under “digital arrest” and could not contact anyone.'),
        ...storyCard(452, 'banknote', 'The loss', '₹29,500 was sent by UPI. The next day, ₹7 lakh was taken from his bank account.'),
        ...footer('Source: PTI and Outlook Money, November 2024'),
      ],
    },
    {
      name: 'The problem',
      items: [
        eyebrow('The problem', 150),
        text(M, 186, 620, 190, 'Fake sites now look real. Most tools answer with one word and no reason.', { size: 44, lh: 1.2, weight: 600, ls: -0.03 }),
        text(M, 402, 610, 110, 'Phishing pages, fake job portals and payment scams copy trusted brands. People need to see why a link is risky, not only a label.', { size: 21, lh: 1.5, color: C.grey }),
        box(760, 118, 448, 480),
        text(800, 154, 370, 26, 'October 2026', { size: 18, color: C.grey }),
        text(800, 190, 370, 130, '8', { size: 112, lh: 1.1, weight: 600, ls: -0.03 }),
        text(800, 328, 370, 110, 'eMudhra intermediate certificates exposed by weak key generation. Browsers moved to block them.', { size: 22, lh: 1.4 }),
        text(800, 472, 370, 90, 'A padlock shows an encrypted connection. It does not prove a site is honest.', { size: 18, lh: 1.45, color: C.grey }),
        ...footer('Source: eMudhra disclosure via Deccan Herald and Inc42, October 2026'),
      ],
    },
    {
      name: 'The numbers',
      items: [
        text(M, 112, 740, 112, '₹19,813 crore', { size: 92, lh: 1.15, weight: 600, ls: -0.04 }),
        text(M, 232, 700, 90, 'reported lost to cyber fraud in India in 2025, across about 21.78 lakh complaints.', { size: 26, lh: 1.35, ls: -0.02 }),
        ...statCard(72, '971,181', 'phishing attacks worldwide in Q1 2026, up 13.8% on the previous quarter.'),
        ...statCard(442, '$20.9 billion', 'in internet crime losses reported to the FBI in 2025, up 26% on 2024.'),
        img(asset('india-dots.png'), 'Dot map of India', 836, 130, 372, 415),
        ...footer('Sources: I4C data via IANS and press reports; APWG Q1 2026 report; FBI IC3 2025 report'),
      ],
    },
    {
      name: 'The question',
      items: [
        text(M, 222, 900, 32, 'How might we...', { size: 24, color: C.grey }),
        text(M, 276, 1110, 200, 'give every internet user clear, evidence-backed assurance about a link, message or certificate before they trust it?', { size: 46, lh: 1.25, ls: -0.03 }),
        ...footer(),
      ],
    },
    {
      name: 'Showcase of the solution',
      items: [
        eyebrow('The solution', 104),
        text(M, 134, 460, 100, 'Verify what you are about to trust.', { size: 38, lh: 1.2, weight: 600, ls: -0.03 }),
        text(M, 240, 450, 90, 'Paste a link or a message. See the risk, the evidence and what to do next.', { size: 19, lh: 1.45, color: C.grey }),
        ...smallCard(72, 348, 'link', 'URL and redirect investigation'),
        ...smallCard(298, 348, 'lock-keyhole', 'TLS certificate analysis'),
        ...smallCard(72, 456, 'message-square-warning', 'Scam message analysis'),
        ...smallCard(298, 456, 'file-search', 'Evidence-backed explanations'),
        box(594, 130, 580, 372, { fill: C.laptop, radius: 14 }),
        img(asset('dashboard.png'), 'WebAssure dashboard', 606, 142, 556, 348),
        box(564, 502, 640, 14, { fill: C.base, radius: 7 }),
        box(844, 502, 80, 6, { fill: C.laptop, radius: 3 }),
        text(564, 532, 640, 22, 'WebAssure dashboard, shown with sample scans', { size: 14, lh: 1.3, color: C.grey, align: 'center' }),
        ...footer(),
      ],
    },
    {
      name: 'Live demo',
      items: [
        eyebrow('See it working', 96),
        text(M, 122, 416, 64, 'Live demo', { size: 52, lh: 1.15, weight: 600, ls: -0.035 }),
        ...demoTab(196, '1', 'Sign in with Google', true),
        ...demoTab(266, '2', 'Paste a suspicious link'),
        ...demoTab(336, '3', 'Read the risk, evidence and limits'),
        ...demoTab(406, '4', 'Check a scam message'),
        box(M, 476, 416, 52),
        text(M + 20, 491, 110, 22, 'Solution URL', { size: 13, lh: 1.3, color: C.grey }),
        box(520, 140, 688, 388, { radius: 36, stroke: C.line }),
        text(520, 544, 688, 24, 'Demo video', { size: 15, lh: 1.3, color: C.grey, align: 'center' }),
        ...footer(),
      ],
    },
    {
      name: 'Impact',
      items: [
        eyebrow('Impact', 120),
        text(M, 150, 330, 120, 'A reason you can act on.', { size: 46, lh: 1.15, weight: 600, ls: -0.03 }),
        box(M, 328, 340, 128),
        text(98, 350, 300, 62, '5', { size: 46, lh: 1.15, weight: 600, ls: -0.03 }),
        text(98, 412, 300, 28, 'evidence-based risk classes', { size: 18, lh: 1.3, color: C.grey }),
        box(M, 468, 340, 128),
        text(98, 490, 300, 62, '112', { size: 46, lh: 1.15, weight: 600, ls: -0.03 }),
        text(98, 552, 300, 28, 'automated tests passing', { size: 18, lh: 1.3, color: C.grey }),
        ...gridCard(440, 120, 'file-search', 'Evidence, not verdicts', 'Every finding shows its evidence and source, not a bare “safe” or “malicious”.'),
        ...gridCard(832, 120, 'lock-keyhole', 'A padlock is not proof', 'TLS is checked, and never treated as proof that a site is honest.'),
        ...gridCard(440, 366, 'shield-alert', 'No false all-clear', 'A check that fails is reported as unavailable, never as a clean result.'),
        ...gridCard(832, 366, 'scan-search', 'Check before acting', 'Links and messages can be checked before money or data moves.'),
        ...footer('Goals of the product. Not yet measured with real users.'),
      ],
    },
    {
      name: 'System architecture',
      items: [
        eyebrow('How it works'),
        title('System architecture'),
        ...panel(72, 'Frontend', [
          [useIcon('laptop'), 'Browser', 'Google or email sign-in'],
          [useLogo('nextdotjs'), 'Next.js', 'Dashboard and API proxy'],
          [useLogo('react'), 'React', 'Investigation workspace'],
          [useLogo('ethers'), 'ethers.js', 'Wallet and contract calls'],
        ]),
        ...panel(470, 'Backend', [
          [useLogo('fastapi'), 'FastAPI', 'Investigation API'],
          [useLogo('python'), 'Python checks', 'URL, DNS, HTTP, TLS and HTML'],
          [useIcon('shield-check'), 'Risk rules', 'Deterministic classification'],
          [useLogo('scikitlearn'), 'scikit-learn', 'Scam message classifier'],
        ]),
        ...panel(868, 'Services', [
          [useLogo('supabase'), 'Supabase', 'Auth and avatar storage'],
          [useLogo('postgresql'), 'Postgres', 'Owner-only report storage'],
          [useLogo('google'), 'Safe Browsing', 'Reputation lookup'],
          [useLogo('googlegemini'), 'Gemini', 'Optional explanations'],
        ]),
        arrow(412, 336, 470, 336),
        arrow(810, 336, 868, 336),
        arrow(242, 496, 242, 530),
        box(M, 530, 1136, 104),
        text(96, 570, 150, 28, 'Blockchain', { size: 18, lh: 1.3, weight: 600, ls: -0.01 }),
        ...row(250, 552, 290, useIcon('fingerprint'), 'Report fingerprint', 'Keccak-256 digest'),
        arrow(540, 581, 580, 581),
        ...row(580, 552, 290, useLogo('solidity'), 'ThreatRegistry', 'Solidity smart contract'),
        arrow(870, 581, 910, 581),
        ...row(910, 552, 284, useLogo('ethereum'), 'EVM chain', 'Local today, Sepolia prepared'),
        ...footer(),
      ],
    },
    {
      name: 'Blockchain',
      items: [
        eyebrow('How we use blockchain'),
        title('A tamper-evident record for every report.'),
        ...chainStep(72, useIcon('file-check-2'), 'Snapshot', 'A saved report is frozen with a random 32-byte nonce.'),
        arrow(329, 295, 365, 295),
        ...chainStep(365, useIcon('fingerprint'), 'Fingerprint', 'Keccak-256 of canonical JSON gives one digest.'),
        arrow(622, 295, 658, 295),
        ...chainStep(658, useLogo('solidity'), 'Register', 'Your wallet sends only the digest to the ThreatRegistry contract.'),
        arrow(915, 295, 951, 295),
        ...chainStep(951, useIcon('badge-check'), 'Verify', 'The receipt can be checked independently, with no login or server.'),
        ...factCard(72, 'On-chain', 'Only the fingerprint, reporter wallet and timestamp.'),
        ...factCard(456, 'Off-chain', 'The report, its URLs and any personal data stay private.'),
        ...factCard(840, 'What it proves', 'Integrity and wallet provenance, not that a report is true.'),
        ...footer('Runs on a local EVM chain today. Sepolia deployment is prepared.'),
      ],
    },
    {
      name: 'Tech stack',
      items: [
        text(M, 76, 400, 64, 'Tech stack', { size: 46, lh: 1.15, weight: 600, ls: -0.03 }),
        ...stackBox(96, 186, 224, 'Web', [['nextdotjs', 'Next.js'], ['react', 'React'], ['ethers', 'ethers.js'], ['supabase', 'Supabase Auth']]),
        ...stackBox(96, 450, 140, 'Web3', [['ethereum', 'Local EVM'], ['solidity', 'Solidity']]),
        ...stackBox(500, 76, 224, 'Backend Server', [['fastapi', 'FastAPI'], ['python', 'Python'], ['scikitlearn', 'scikit-learn'], [null, 'Uvicorn']]),
        ...stackBox(500, 370, 224, 'Data Storage', [['supabase', 'Supabase'], ['postgresql', 'PostgreSQL'], ['google', 'Google sign-in'], [null, 'Row-level security']]),
        ...stackBox(904, 186, 224, 'Intelligence', [['googlegemini', 'Gemini'], ['google', 'Safe Browsing'], [null, 'Homoglyph checks'], [null, 'Rule-based risk']]),
        arrow(236, 150, 236, 186),
        arrow(236, 150, 500, 150),
        arrow(1044, 150, 1044, 186),
        arrow(1044, 150, 780, 150),
        arrow(640, 335, 640, 300),
        arrow(640, 335, 640, 370),
        arrow(236, 430, 236, 410),
        arrow(236, 430, 236, 450),
        ...footer(),
      ],
    },
    {
      name: 'Next steps',
      items: [
        eyebrow('Where we go from here', 120),
        text(M, 150, 330, 70, 'Next steps', { size: 52, lh: 1.15, weight: 600, ls: -0.035 }),
        text(M, 232, 320, 120, 'WebAssure is a working local MVP. These steps take it to a public product.', { size: 20, lh: 1.5, color: C.grey }),
        text(M, 502, 330, 56, 'Thank you.', { size: 42, lh: 1.2, weight: 600, ls: -0.03 }),
        text(M, 562, 340, 26, 'Team Fantastic 4  |  HackMatrix 2026', { size: 17, lh: 1.3, color: C.grey }),
        ...gridCard(440, 120, 'rocket', 'Public testnet', 'Deploy the report registry to Sepolia. It runs on a local EVM chain today.', 'Prepared'),
        ...gridCard(832, 120, 'radar', 'Live monitoring', 'Certificate Transparency, revocation and scheduled checks.', 'Planned'),
        ...gridCard(440, 366, 'network', 'Campaign attribution', 'Build on exact shared evidence to validate campaign attribution.', 'Started'),
        ...gridCard(832, 366, 'server', 'Production hardening', 'Per-user limits, retention rules, egress controls and a durable job queue.', 'Planned'),
        ...footer(),
      ],
    },
  ]

  // Every slide after the cover shows the HackMatrix logo, a divider and the page number, top right.
  const branding = (page) => [
    img(asset('logos/hackmatrix.png'), 'HackMatrix', 991, 24, 159, 24),
    box(1163, 26, 1, 20, { fill: C.grey, radius: 0 }),
    text(1172, 26, 36, 20, String(page).padStart(2, '0'), { size: 16, lh: 1.25, weight: 600, align: 'right' }),
  ]
  return slides.map((slide, index) => ({ ...slide, items: slide.cover ? slide.items : [...slide.items, ...branding(index + 1)] }))
}
