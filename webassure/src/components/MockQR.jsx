// Decorative QR-style code for the demo checkout. It does NOT encode a real
// payment address, so it cannot be used to send money.
function rng(seed) {
  let s = 0
  for (const c of seed) s = (s * 31 + c.charCodeAt(0)) >>> 0
  return () => {
    s ^= s << 13; s >>>= 0
    s ^= s >> 17
    s ^= s << 5; s >>>= 0
    return s / 4294967296
  }
}

export default function MockQR({ seed = 'webassure', size = 200 }) {
  const N = 29
  const rand = rng(seed)
  const finder = (r, c) => {
    const inBox = (r0, c0) => r >= r0 && r < r0 + 7 && c >= c0 && c < c0 + 7
    return inBox(0, 0) || inBox(0, N - 7) || inBox(N - 7, 0)
  }
  const cells = []
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (finder(r, c)) continue
      if ((r === 7 || c === 7 || r === N - 8 || c === N - 8) && (r < 8 || c < 8 || r > N - 9 || c > N - 9)) continue
      if (r >= 12 && r <= 16 && c >= 12 && c <= 16) continue // centre logo space
      if (rand() > 0.52) cells.push(<rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" rx="0.18" />)
    }
  }
  const Finder = ({ x, y }) => (
    <g transform={`translate(${x} ${y})`}>
      <rect width="7" height="7" rx="1.6" />
      <rect x="1" y="1" width="5" height="5" rx="1.1" fill="#fff" />
      <rect x="2" y="2" width="3" height="3" rx="0.8" />
    </g>
  )
  return (
    <svg className="qr" width={size} height={size} viewBox={`-2 -2 ${N + 4} ${N + 4}`} role="img" aria-label="Demo payment QR code">
      <rect x="-2" y="-2" width={N + 4} height={N + 4} rx="3" fill="#fff" />
      <g fill="#111216">
        {cells}
        <Finder x={0} y={0} />
        <Finder x={N - 7} y={0} />
        <Finder x={0} y={N - 7} />
      </g>
      <rect x="11.6" y="11.6" width="5.8" height="5.8" rx="1.6" fill="#4672ff" />
      <path d="M13.2 13.6l1.1 2.3 1-1.6 1 1.6" fill="none" stroke="#fff" strokeWidth="0.55" strokeLinecap="round" strokeLinejoin="round" transform="translate(-0.6 -0.4)" />
    </svg>
  )
}
