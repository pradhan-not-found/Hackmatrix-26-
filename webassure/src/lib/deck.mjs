// Pitch deck content. One layout model drives the preview, the PPTX and the PDF.
// Coordinates are pixels on a 1280 x 720 slide.

export const W = 1280
export const H = 720
export const C = {
  bg: '121212', tile: '1C1C1C', console: '252525', line: '333333',
  ink: 'F1F1F1', grey: '8A8A8A', pink: 'FF38D4', blue: '2CC5F9', green: '44F33E',
}

const text = (x, y, w, h, value, o = {}) => ({ type: 'text', x, y, w, h, value, size: 20, lh: 1.4, color: C.ink, ...o })
const box = (x, y, w, h, o = {}) => ({ type: 'rect', x, y, w, h, fill: C.tile, radius: 12, ...o })
const arrow = (x1, y1, x2, y2) => ({ type: 'arrow', x1, y1, x2, y2, color: C.grey })

const M = 72
const eyebrow = (value, y = 64, x = M) => text(x, y, 700, 26, value, { size: 18, color: C.grey })
const title = (value, y = 92, w = 1136) => text(M, y, w, 64, value, { size: 46, lh: 1.15, weight: 600, ls: -0.03 })

const footer = (source) => [
  text(M, 672, 300, 20, [{ t: 'webassure', b: true }, { t: '  |  HackMatrix 2026', c: C.grey }], { size: 13, lh: 1.3 }),
  ...(source ? [text(372, 672, 836, 20, source, { size: 12, lh: 1.3, color: C.grey, align: 'right' })] : []),
]

// A heading plus a few short lines, used by the tech stack cards.
const stackCard = (x, heading, items) => [
  box(x, 196, 211, 340),
  text(x + 22, 220, 170, 28, heading, { size: 20, weight: 600, ls: -0.02 }),
  ...items.map((item, i) => text(x + 22, 272 + i * 58, 172, 50, item, { size: 16, lh: 1.3, color: C.grey })),
]

const swatch = (x, y, hex, name) => [
  box(x, y, 152, 72, { fill: hex, stroke: C.line }),
  text(x, y + 80, 152, 20, name, { size: 14, lh: 1.3 }),
  text(x, y + 100, 152, 18, `#${hex}`, { size: 12, lh: 1.3, color: C.grey }),
]

const typeRow = (y, specimen, opts, detail) => [
  text(M, y, 310, 56, specimen, { lh: 1.2, ...opts }),
  text(392, y + 6, 240, 44, detail, { size: 14, lh: 1.4, color: C.grey }),
]

const step = (y, n, value) => [
  text(620, y, 60, 40, n, { size: 26, lh: 1.3, color: C.grey, weight: 600 }),
  text(684, y, 524, 80, value, { size: 26, lh: 1.3, ls: -0.015 }),
]

const impactRow = (y, before, after) => [
  text(M, y, 500, 34, before, { size: 22, lh: 1.3, color: C.grey }),
  arrow(592, y + 15, 646, y + 15),
  text(672, y, 536, 34, after, { size: 22, lh: 1.3 }),
  { type: 'arrow', x1: M, y1: y + 52, x2: 1208, y2: y + 52, color: C.line, plain: true },
]

const nextStep = (x, n, heading, body) => [
  { type: 'arrow', x1: x, y1: 216, x2: x + 256, y2: 216, color: C.line, plain: true },
  text(x, 240, 80, 40, n, { size: 24, weight: 600, color: C.grey }),
  text(x, 296, 256, 76, heading, { size: 28, lh: 1.2, weight: 600, ls: -0.02 }),
  text(x, 388, 256, 130, body, { size: 18, lh: 1.45, color: C.grey }),
]

const archBox = (x, y, w, h, heading, sub) => [
  box(x, y, w, h, { stroke: C.line }),
  text(x + 18, y + 22, w - 36, 28, heading, { size: 18, lh: 1.3, weight: 600, ls: -0.01 }),
  ...(sub ? [text(x + 18, y + 52, w - 36, 24, sub, { size: 14, lh: 1.3, color: C.grey })] : []),
]

// Official event logos from hackmatrix.codes, with width-to-height ratios.
// The light tiles keep their dark lettering readable on the dark slides.
const LOGOS = [
  ['hackmatrix', 'HackMatrix', 1.435],
  ['mlh', 'Major League Hacking', 2.379],
  ['acm', 'Association for Computing Machinery', 2.857],
  ['adamas', 'Adamas University', 1.143],
]

const logoRow = (x, y, tileW, tileH, gap) => LOGOS.flatMap(([file, alt, ratio], i) => {
  const left = x + i * (tileW + gap)
  const maxW = tileW - 24
  const maxH = tileH - 18
  const w = Math.min(maxW, maxH * ratio)
  const h = w / ratio
  return [
    box(left, y, tileW, tileH, { fill: C.ink, radius: 10 }),
    { type: 'image', logo: true, src: `/deck/logos/${file}.png`, alt, x: left + (tileW - w) / 2, y: y + (tileH - h) / 2, w, h },
  ]
})

export const SLIDES = [
  {
    name: 'Cover',
    items: [
      { type: 'shield', x: 148, y: 226, size: 296 },
      { type: 'wordmark', x: 540, y: 150, size: 104 },
      text(544, 290, 640, 44, 'Know your website before you trust it.', { size: 30, lh: 1.3, ls: -0.02 }),
      text(544, 342, 640, 26, 'Team Fantastic 4', { size: 18, color: C.grey }),
      text(544, 450, 640, 22, 'Built at HackMatrix 2026. Powered by MLH, ACM and Adamas University.', { size: 14, lh: 1.3, color: C.grey }),
      ...logoRow(544, 484, 140, 72, 12),
    ],
  },
  {
    name: 'The story',
    items: [
      text(130, 240, 1020, 240, [
        { t: 'An IIT Bombay student lost ' }, { t: '₹7.29 lakh', b: true }, { t: ' to callers posing as officials. ' },
        { t: 'He understood it was a scam only after searching for it online.', b: true },
      ], { size: 44, lh: 1.3, align: 'center', ls: -0.025 }),
      ...footer('Source: PTI via Business Standard, November 2024'),
    ],
  },
  {
    name: 'The problem',
    items: [
      eyebrow('The problem', 150),
      text(M, 186, 620, 230, 'Fake sites now look real. Most tools answer with one word and no reason.', { size: 44, lh: 1.2, weight: 600, ls: -0.03 }),
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
      text(M, 118, 1136, 130, '₹19,813 crore', { size: 112, lh: 1.1, weight: 600, ls: -0.04 }),
      text(M, 262, 880, 90, 'reported lost to cyber fraud in India in 2025, across about 21.78 lakh complaints.', { size: 30, lh: 1.35, ls: -0.02 }),
      { type: 'arrow', x1: M, y1: 396, x2: 1208, y2: 396, color: C.line, plain: true },
      text(M, 428, 520, 72, '971,181', { size: 58, lh: 1.15, weight: 600, ls: -0.03 }),
      text(M, 508, 500, 66, 'phishing attacks worldwide in Q1 2026, up 13.8% on the previous quarter.', { size: 20, lh: 1.45, color: C.grey }),
      text(668, 428, 520, 72, '$20.9 billion', { size: 58, lh: 1.15, weight: 600, ls: -0.03 }),
      text(668, 508, 500, 66, 'in internet crime losses reported to the FBI in 2025, up 26% on 2024.', { size: 20, lh: 1.45, color: C.grey }),
      ...footer('Sources: I4C data via IANS and press reports; APWG Q1 2026 report; FBI IC3 2025 report'),
    ],
  },
  {
    name: 'The question',
    items: [
      text(M, 232, 900, 32, 'How might we...', { size: 24, color: C.grey }),
      text(M, 286, 1090, 200, 'help anyone check a suspicious link, message or certificate, and understand the evidence before they trust it?', { size: 48, lh: 1.25, ls: -0.03 }),
      ...footer(),
    ],
  },
  {
    name: 'The solution',
    items: [
      { type: 'wordmark', x: M, y: 92, size: 50 },
      text(M, 178, 440, 130, 'Paste a link or a message. See the risk, the evidence and what to do next.', { size: 28, lh: 1.3, ls: -0.02 }),
      ...['URL and redirect investigation', 'TLS certificate verification', 'Scam message analysis', 'Plain-language explanations'].flatMap((item, i) => [
        { type: 'arrow', x1: M, y1: 352 + i * 62, x2: 512, y2: 352 + i * 62, color: C.line, plain: true },
        text(M, 368 + i * 62, 440, 30, item, { size: 20, lh: 1.3, color: C.grey }),
      ]),
      { type: 'image', x: 576, y: 124, w: 632, h: 395, src: '/deck/landing.png', alt: 'WebAssure home page', stroke: C.line },
      text(576, 534, 632, 24, 'webassure, running live', { size: 14, lh: 1.3, color: C.grey }),
      ...footer(),
    ],
  },
  {
    name: 'Live demo',
    items: [
      text(M, 170, 480, 180, 'Now, the live demo.', { size: 72, lh: 1.08, weight: 600, ls: -0.035 }),
      text(M, 366, 440, 90, 'The whole journey, from a suspicious link to an explained result.', { size: 22, lh: 1.45, color: C.grey }),
      ...step(166, '1', 'Sign in with Google.'),
      ...step(262, '2', 'Paste a suspicious link and start the scan.'),
      ...step(358, '3', 'Read the risk class, evidence and limits.'),
      ...step(454, '4', 'Paste a scam message and see why it was flagged.'),
      ...footer(),
    ],
  },
  {
    name: 'Impact',
    items: [
      eyebrow('Impact'),
      title('From a one-word verdict to a reason you can act on.'),
      text(M, 190, 500, 26, 'Today', { size: 16, color: C.grey }),
      text(672, 190, 500, 26, 'With webassure', { size: 16, color: C.grey }),
      ...impactRow(226, '“Safe” or “malicious”, with no reason', 'Every finding shows its evidence and source'),
      ...impactRow(298, 'A padlock is taken as proof of safety', 'TLS is checked, and never treated as proof'),
      ...impactRow(370, 'A failed check can look like a clean result', 'Unavailable checks are reported as unavailable'),
      ...impactRow(442, 'Scams are understood after the money is gone', 'Links and messages are checked before anyone acts'),
      text(M, 540, 240, 60, '5', { size: 48, lh: 1.15, weight: 600 }),
      text(120, 552, 300, 50, 'evidence-based risk classes', { size: 18, lh: 1.3, color: C.grey }),
      text(444, 540, 240, 60, '95', { size: 48, lh: 1.15, weight: 600 }),
      text(524, 552, 280, 50, 'automated tests passing', { size: 18, lh: 1.3, color: C.grey }),
      ...footer('Goals of the product. Not yet measured with real users.'),
    ],
  },
  {
    name: 'System architecture',
    items: [
      eyebrow('How it works'),
      title('System architecture'),
      ...archBox(72, 214, 220, 104, 'Browser', 'Next.js dashboard'),
      ...archBox(352, 214, 220, 104, 'API proxy', 'Next.js, user token'),
      ...archBox(632, 214, 220, 104, 'Investigation API', 'Python and FastAPI'),
      box(912, 190, 296, 152, { stroke: C.line }),
      text(932, 208, 256, 26, 'Analysis pipeline', { size: 18, lh: 1.3, weight: 600, ls: -0.01 }),
      text(932, 240, 256, 90, 'URL, DNS, HTTP, TLS and HTML checks, then rule-based risk and an explanation', { size: 15, lh: 1.4, color: C.grey }),
      arrow(292, 266, 352, 266),
      arrow(572, 266, 632, 266),
      arrow(852, 266, 912, 266),
      arrow(182, 318, 182, 462),
      text(194, 376, 150, 40, 'Sign-in, photos', { size: 13, lh: 1.3, color: C.grey }),
      arrow(742, 318, 742, 462),
      text(754, 370, 150, 54, 'Verify token, save report as user', { size: 13, lh: 1.3, color: C.grey }),
      arrow(1060, 342, 1060, 462),
      box(72, 462, 780, 132, { stroke: C.line }),
      text(92, 480, 300, 26, 'Supabase', { size: 18, lh: 1.3, weight: 600, ls: -0.01 }),
      ...[['Auth', 'Google and email', 92], ['Postgres', 'Owner-only row security', 342], ['Storage', 'Profile photos', 592]].flatMap(([a, b, x]) => [
        box(x, 516, 236, 60, { fill: C.console, radius: 8 }),
        text(x + 14, 523, 208, 24, a, { size: 15, lh: 1.3 }),
        text(x + 14, 547, 208, 22, b, { size: 13, lh: 1.3, color: C.grey }),
      ]),
      box(912, 462, 296, 132, { stroke: C.line }),
      text(932, 480, 256, 26, 'External services', { size: 18, lh: 1.3, weight: 600, ls: -0.01 }),
      text(932, 516, 256, 60, 'Google Safe Browsing and Gemini, both optional', { size: 15, lh: 1.4, color: C.grey }),
      ...footer(),
    ],
  },
  {
    name: 'Tech stack',
    items: [
      eyebrow('What it is built with'),
      title('Tech stack'),
      ...stackCard(72, 'Frontend', ['Next.js 14', 'React 18', 'Light and dark themes']),
      ...stackCard(303, 'Backend', ['Python', 'FastAPI', 'Uvicorn']),
      ...stackCard(534, 'Data and auth', ['Supabase Postgres', 'Row-level security', 'Google sign-in', 'Avatar storage']),
      ...stackCard(765, 'Intelligence', ['Google Safe Browsing', 'Gemini', 'scikit-learn classifier', 'Homoglyph detection']),
      ...stackCard(996, 'Testing', ['unittest', 'Playwright', 'Node test runner']),
      ...footer(),
    ],
  },
  {
    name: 'Design system',
    items: [
      eyebrow('How it looks'),
      title('Design system', 92, 560),
      ...typeRow(196, 'webassure', { font: 'brand', size: 40, weight: 600, ls: -0.025 }, 'Archivo, semi-bold\nBrand wordmark'),
      ...typeRow(268, 'Headline', { size: 40, weight: 600, ls: -0.03 }, 'Hanken Grotesk, semi-bold\nHeadings'),
      ...typeRow(340, 'Body text', { size: 24 }, 'Hanken Grotesk, regular\nReading text'),
      ...typeRow(400, 'Caption', { size: 16, color: C.grey }, 'Hanken Grotesk, regular\nLabels and notes'),
      box(M, 482, 134, 44, { fill: C.ink, radius: 22 }),
      text(M, 494, 134, 22, 'Button', { size: 15, lh: 1.3, weight: 600, color: C.bg, align: 'center' }),
      box(226, 482, 134, 44, { fill: C.bg, radius: 22, stroke: C.line }),
      text(226, 494, 134, 22, 'Secondary', { size: 15, lh: 1.3, weight: 600, align: 'center' }),
      text(392, 482, 240, 44, 'Pill buttons, 12 px card corners\nDark and light themes', { size: 14, lh: 1.4, color: C.grey }),
      text(M, 560, 560, 48, 'Quiet, monochrome surfaces keep attention on the evidence. Heat colors are used sparingly.', { size: 15, lh: 1.45, color: C.grey }),
      ...swatch(680, 110, C.bg, 'Ground'),
      ...swatch(848, 110, C.tile, 'Tile'),
      ...swatch(1016, 110, C.console, 'Surface'),
      ...swatch(680, 256, C.line, 'Line'),
      ...swatch(848, 256, C.grey, 'Muted'),
      ...swatch(1016, 256, C.ink, 'Ink'),
      ...swatch(680, 402, C.pink, 'Heat pink'),
      ...swatch(848, 402, C.blue, 'Heat blue'),
      ...swatch(1016, 402, C.green, 'Heat green'),
      ...footer(),
    ],
  },
  {
    name: 'Next steps',
    items: [
      eyebrow('Where we go from here'),
      title('Next steps'),
      ...nextStep(72, '1', 'Threat ledger', 'A smart contract for on-chain report hashes and independent verification.'),
      ...nextStep(365, '2', 'Deeper certificate checks', 'Certificate Transparency, revocation and key strength.'),
      ...nextStep(658, '3', 'Campaign correlation', 'Link reports that share domains, infrastructure or payment details.'),
      ...nextStep(951, '4', 'Production hardening', 'Per-user limits, retention rules, egress controls and a durable job queue.'),
      text(M, 570, 600, 40, 'Thank you.', { size: 30, lh: 1.3, weight: 600, ls: -0.02 }),
      ...logoRow(778, 564, 100, 52, 10),
      ...footer(),
    ],
  },
]
