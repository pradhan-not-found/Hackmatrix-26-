// Pitch deck content. One layout model drives the preview, the PPTX and the PDF.
// Coordinates are pixels on a 1280 x 720 slide.

export const W = 1280
export const H = 720
export const C = {
  bg: '121212', tile: '1C1C1C', console: '252525', line: '333333', laptop: '2A2A2A', base: '3A3A3A',
  ink: 'F1F1F1', grey: '8A8A8A', pink: 'FF38D4', blue: '2CC5F9', green: '44F33E',
}

// Shown on the demo slide. Replace with the deployed address once there is one.
const SOLUTION_URL = 'github.com/pradhan-not-found/Hackmatrix-26-'

const M = 72
const text = (x, y, w, h, value, o = {}) => ({ type: 'text', x, y, w, h, value, size: 20, lh: 1.4, color: C.ink, ...o })
const box = (x, y, w, h, o = {}) => ({ type: 'rect', x, y, w, h, fill: C.tile, radius: 12, ...o })
const img = (src, alt, x, y, w, h) => ({ type: 'image', src, alt, x, y, w, h })
const arrow = (x1, y1, x2, y2) => ({ type: 'arrow', x1, y1, x2, y2, color: C.grey })

const eyebrow = (value, y = 76, x = M) => text(x, y, 700, 26, value, { size: 18, color: C.grey })
const title = (value, y = 104, w = 1136) => text(M, y, w, 64, value, { size: 46, lh: 1.15, weight: 600, ls: -0.03 })

const footer = (source) => [
  text(M, 672, 300, 20, [{ t: 'webassure', b: true }, { t: '  |  HackMatrix 2026', c: C.grey }], { size: 13, lh: 1.3 }),
  ...(source ? [text(372, 672, 836, 20, source, { size: 12, lh: 1.3, color: C.grey, align: 'right' })] : []),
]

// Light tile holding a technology logo and its name.
const tech = (x, y, w, h, icon, label) => {
  const size = Math.min(h - 38, 44)
  return [
    box(x, y, w, h, { fill: C.ink, radius: 10 }),
    ...(icon ? [img(`/deck/tech/${icon}.png`, label, x + (w - size) / 2, y + 9, size, size)] : []),
    text(x + 4, icon ? y + h - 24 : y + h / 2 - 9, w - 8, 18, label, { size: 12, lh: 1.3, weight: 600, color: C.bg, align: 'center' }),
  ]
}

const tag = (x, y, w, value, color) => [
  box(x, y, w, 38, { fill: C.bg, stroke: color, radius: 4 }),
  text(x, y + 8, w, 24, value, { size: 17, lh: 1.3, weight: 600, ls: 0.02, color, align: 'center' }),
]

const stackBox = (x, y, h, heading, tiles) => [
  box(x, y, 280, h, { fill: C.bg, stroke: C.grey }),
  text(x, y + 14, 280, 28, heading, { size: 20, lh: 1.3, weight: 600, align: 'center', ls: -0.01 }),
  ...tiles.flatMap(([icon, label], i) => tech(x + 22 + (i % 2) * 124, y + 52 + Math.floor(i / 2) * 84, 112, 74, icon, label)),
]

const storyCard = (y, n, heading, body) => [
  box(640, y, 568, 104),
  text(664, y + 22, 40, 22, n, { size: 16, lh: 1.3, weight: 600, color: C.grey }),
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
  img(`/deck/team/${file}.png`, name, x + 20, 208, 226, 282),
  text(x + 20, 510, 226, 30, name, { size: 20, lh: 1.3, weight: 600, ls: -0.01 }),
  text(x + 20, 542, 226, 24, 'Fantastic 4', { size: 15, lh: 1.3, color: C.grey }),
]

const smallCard = (x, y, value) => [
  box(x, y, 214, 96),
  text(x + 18, y + 22, 180, 56, value, { size: 17, lh: 1.35 }),
]

const demoStep = (y, n, value) => [
  box(M, y, 416, 58),
  text(M + 20, y + 18, 30, 24, n, { size: 16, lh: 1.3, weight: 600, color: C.grey }),
  text(M + 56, y + 17, 340, 26, value, { size: 17, lh: 1.3 }),
]

const impactRow = (y, before, after) => [
  box(M, y, 1136, 62),
  text(96, y + 19, 480, 28, before, { size: 20, lh: 1.25, color: C.grey }),
  arrow(592, y + 31, 642, y + 31),
  text(668, y + 19, 520, 28, after, { size: 20, lh: 1.25 }),
]

const nextCard = (x, n, heading, body) => [
  box(x, 180, 266, 310),
  text(x + 24, 206, 60, 26, n, { size: 18, lh: 1.3, weight: 600, color: C.grey }),
  text(x + 24, 250, 222, 72, heading, { size: 28, lh: 1.2, weight: 600, ls: -0.02 }),
  text(x + 24, 340, 222, 130, body, { size: 17, lh: 1.45, color: C.grey }),
]

const CONTENT = [
  {
    name: 'Cover',
    items: [
      { type: 'shield', x: 148, y: 222, size: 296 },
      { type: 'wordmark', x: 540, y: 176, size: 104 },
      text(544, 316, 640, 44, 'Know your website before you trust it.', { size: 30, lh: 1.3, ls: -0.02 }),
      text(544, 384, 640, 34, 'HackMatrix 2026', { size: 24, lh: 1.3, weight: 600, ls: -0.015 }),
      text(544, 420, 640, 26, 'AI-Powered Web Threat Detection and Digital Trust Intelligence', { size: 17, lh: 1.3, color: C.grey }),
      text(544, 448, 640, 26, 'Powered by MLH, ACM and Adamas University', { size: 17, lh: 1.3, color: C.grey }),
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
      text(M, 404, 490, 90, 'He realised it was a scam only after searching online about digital arrest.', { size: 20, lh: 1.5, color: C.grey }),
      ...storyCard(104, '01', 'The call', 'A caller claiming to be from TRAI said 17 complaints were registered against his number.'),
      ...storyCard(220, '02', 'The pressure', 'On a WhatsApp video call, a man dressed as a police officer accused him of money laundering.'),
      ...storyCard(336, '03', 'The isolation', 'He was told he was under “digital arrest” and could not contact anyone.'),
      ...storyCard(452, '04', 'The loss', '₹29,500 was sent by UPI. The next day, ₹7 lakh was taken from his bank account.'),
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
      img('/deck/india-dots.png', 'Dot map of India', 836, 130, 372, 415),
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
      ...smallCard(72, 348, 'URL and redirect investigation'),
      ...smallCard(298, 348, 'TLS certificate analysis'),
      ...smallCard(72, 456, 'Scam message analysis'),
      ...smallCard(298, 456, 'Evidence-backed explanations'),
      box(594, 130, 580, 372, { fill: C.laptop, radius: 14 }),
      img('/deck/dashboard.png', 'WebAssure investigation report', 606, 142, 556, 348),
      box(564, 502, 640, 14, { fill: C.base, radius: 7 }),
      box(844, 502, 80, 6, { fill: C.laptop, radius: 3 }),
      text(564, 532, 640, 22, 'WebAssure investigation report, shown with a sample scan', { size: 14, lh: 1.3, color: C.grey, align: 'center' }),
      ...footer(),
    ],
  },
  {
    name: 'Live demo',
    items: [
      eyebrow('See it working', 96),
      text(M, 122, 416, 64, 'Live demo', { size: 52, lh: 1.15, weight: 600, ls: -0.035 }),
      box(M, 196, 300, 54, { fill: C.ink, radius: 27 }),
      img('/deck/tech/google.png', 'Google', 96, 210, 26, 26),
      text(136, 210, 230, 28, 'Sign in with Google', { size: 19, lh: 1.3, weight: 600, color: C.bg }),
      ...demoStep(262, '1', 'Paste a suspicious link'),
      ...demoStep(330, '2', 'Read the risk, evidence and limits'),
      ...demoStep(398, '3', 'Check a scam message'),
      box(M, 466, 416, 62),
      text(92, 475, 380, 18, 'Solution URL', { size: 13, lh: 1.3, color: C.grey }),
      text(92, 496, 380, 24, SOLUTION_URL, { size: 16, lh: 1.3 }),
      box(520, 140, 688, 388, { radius: 36, stroke: C.line }),
      box(820, 290, 88, 88, { fill: C.ink, radius: 44 }),
      img('/deck/icons/play.png', 'Play', 846, 316, 40, 36),
      text(520, 472, 688, 24, 'Demo video', { size: 15, lh: 1.3, color: C.grey, align: 'center' }),
      ...footer(),
    ],
  },
  {
    name: 'Impact',
    items: [
      eyebrow('Impact'),
      title('From a one-word verdict to a reason you can act on.'),
      text(96, 172, 480, 22, 'Today', { size: 15, lh: 1.3, color: C.grey }),
      text(668, 172, 500, 22, 'With WebAssure', { size: 15, lh: 1.3, color: C.grey }),
      ...impactRow(198, '“Safe” or “malicious”, with no reason', 'Every finding shows its evidence and source'),
      ...impactRow(270, 'A padlock is taken as proof of safety', 'TLS is checked, and never treated as proof'),
      ...impactRow(342, 'A failed check can look like a clean result', 'Unavailable checks are reported as unavailable'),
      ...impactRow(414, 'Scams are understood after the money is gone', 'Links and messages are checked before anyone acts'),
      box(M, 488, 558, 100),
      text(100, 508, 80, 62, '5', { size: 46, lh: 1.15, weight: 600 }),
      text(170, 526, 440, 28, 'evidence-based risk classes', { size: 20, lh: 1.3, color: C.grey }),
      box(650, 488, 558, 100),
      text(678, 508, 110, 62, '112', { size: 46, lh: 1.15, weight: 600 }),
      text(790, 526, 400, 28, 'automated tests passing', { size: 20, lh: 1.3, color: C.grey }),
      ...footer('Goals of the product. Not yet measured with real users.'),
    ],
  },
  {
    name: 'System architecture',
    items: [
      ...tag(540, 70, 200, 'ARCHITECTURE', C.blue),
      ...tag(206, 122, 140, 'FRONTEND', C.pink),
      ...tag(899, 122, 130, 'BACKEND', C.green),

      ...tech(216, 176, 120, 92, 'laptop', 'Browser'),
      arrow(276, 268, 276, 318),
      box(96, 318, 360, 118, { fill: C.console }),
      ...tech(112, 332, 100, 90, 'nextdotjs', 'Next.js'),
      ...tech(226, 332, 100, 90, 'react', 'React'),
      ...tech(340, 332, 100, 90, 'ethers', 'ethers.js'),
      arrow(276, 436, 276, 480),
      box(156, 480, 240, 110, { fill: C.console }),
      ...tech(170, 494, 100, 82, 'ethereum', 'Local EVM'),
      ...tech(282, 494, 100, 82, 'solidity', 'Registry'),

      arrow(456, 377, 548, 377),
      ...tech(548, 332, 130, 90, 'fastapi', 'FastAPI'),

      arrow(678, 360, 754, 340),
      arrow(678, 398, 754, 498),
      ...tech(770, 176, 122, 64, null, 'URL and DNS'),
      ...tech(904, 176, 122, 64, null, 'TLS certificates'),
      ...tech(1038, 176, 122, 64, null, 'HTML and headers'),
      arrow(831, 284, 831, 240),
      arrow(965, 284, 965, 240),
      arrow(1099, 284, 1099, 240),
      box(754, 284, 420, 112, { fill: C.console }),
      ...tech(770, 298, 122, 84, 'python', 'Python'),
      ...tech(904, 298, 122, 84, 'scikitlearn', 'scikit-learn'),
      ...tech(1038, 298, 122, 84, null, 'Risk rules'),
      box(754, 450, 420, 122, { fill: C.console }),
      ...tech(770, 466, 122, 90, 'supabase', 'Supabase'),
      ...tech(904, 466, 122, 90, 'googlegemini', 'Gemini'),
      ...tech(1038, 466, 122, 90, 'google', 'Safe Browsing'),
      ...footer(),
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
      eyebrow('Where we go from here'),
      title('Next steps'),
      ...nextCard(72, '01', 'Public testnet', 'Deploy the report registry to Sepolia. It runs on a local EVM chain today.'),
      ...nextCard(362, '02', 'Certificate monitoring', 'Certificate Transparency, revocation and scheduled checks.'),
      ...nextCard(652, '03', 'Campaign attribution', 'Build on exact shared evidence to validate campaign attribution.'),
      ...nextCard(942, '04', 'Production hardening', 'Per-user limits, retention rules, egress controls and a durable job queue.'),
      text(M, 524, 600, 56, 'Thank you.', { size: 42, lh: 1.2, weight: 600, ls: -0.03 }),
      text(M, 584, 700, 26, 'Team Fantastic 4  |  HackMatrix 2026', { size: 18, lh: 1.3, color: C.grey }),
      ...footer(),
    ],
  },
]

// HackMatrix and MLH sit in the top corners of every slide.
const BRANDING = [
  img('/deck/logos/hackmatrix-lockup.png', 'HackMatrix', M, 24, 159, 24),
  img('/deck/logos/mlh-light.png', 'Major League Hacking', 1113, 16, 95, 40),
]

export const SLIDES = CONTENT.map((slide) => ({ ...slide, items: [...slide.items, ...BRANDING] }))
