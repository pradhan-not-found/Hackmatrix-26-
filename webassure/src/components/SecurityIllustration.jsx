const COLORS = {
  records: ['#6488e8', '#5fb9bb'], threat: ['#d96c7b', '#d4a24d'],
  verified: ['#41a88a', '#6596e5'], review: ['#d0a04f', '#8781cf'],
  activity: ['#658ae8', '#58b9ae'], assessment: ['#7f80ce', '#49a78e'],
}

/** Decorative vector artwork; nearby labels carry the meaning and actual data. */
export default function SecurityIllustration({ type = 'records', className = '' }) {
  const [primary, secondary] = COLORS[type] || COLORS.records
  return <svg className={`security-illustration ${className}`} viewBox="0 0 80 80" fill="none" aria-hidden="true" focusable="false" style={{ color: primary, '--art-secondary': secondary }}>
    {type === 'records' && <>
      <rect x="21" y="19" width="37" height="48" rx="5" fill="currentColor" opacity=".14" transform="rotate(-9 21 19)" />
      <path d="M28 15h21l12 12v32a5 5 0 0 1-5 5H28a5 5 0 0 1-5-5V20a5 5 0 0 1 5-5Z" fill="var(--card)" stroke="currentColor" strokeWidth="2" />
      <path d="M48 15v13h13M32 35h19M32 43h15M32 51h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="60" cy="60" r="11" fill="var(--art-secondary)" /><path d="m55 60 3 3 6-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>}
    {(type === 'threat' || type === 'verified') && <>
      <path d="m40 14 23 9v17c0 14-10 23-23 29-13-6-23-15-23-29V23l23-9Z" fill="currentColor" opacity=".13" />
      <path d="m40 14 23 9v17c0 14-10 23-23 29-13-6-23-15-23-29V23l23-9Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      {type === 'verified' ? <path d="m29 40 8 8 15-18" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /> : <><path d="M40 29v16" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /><circle cx="40" cy="53" r="2" fill="currentColor" /></>}
      <circle cx="63" cy="19" r="7" fill="var(--art-secondary)" /><path d="M61 19h4m-2-2v4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
    </>}
    {type === 'review' && <>
      <rect x="17" y="17" width="39" height="47" rx="6" fill="var(--card)" stroke="currentColor" strokeWidth="2" />
      <path d="M26 28h19M26 36h14M26 44h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="52" cy="49" r="13" fill="var(--card)" stroke="var(--art-secondary)" strokeWidth="3" /><path d="m62 59 9 10" stroke="var(--art-secondary)" strokeWidth="4" strokeLinecap="round" /><path d="M52 42v8m0 5v.1" stroke="var(--art-secondary)" strokeWidth="2.5" strokeLinecap="round" />
    </>}
    {type === 'activity' && <>
      <rect x="14" y="20" width="52" height="39" rx="6" fill="var(--card)" stroke="currentColor" strokeWidth="2" /><path d="M29 67h22M40 59v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><path d="M21 41h9l6-10 8 20 7-12h8" stroke="var(--art-secondary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /><circle cx="64" cy="19" r="7" fill="var(--art-secondary)" />
    </>}
    {type === 'assessment' && <>
      <path d="M40 16a24 24 0 1 0 24 24H40V16Z" fill="currentColor" opacity=".18" stroke="currentColor" strokeWidth="2" /><path d="M47 12v21h21a24 24 0 0 0-21-21Z" fill="var(--art-secondary)" opacity=".8" /><circle cx="56" cy="58" r="11" fill="var(--card)" stroke="var(--art-secondary)" strokeWidth="2" /><path d="m51 58 3 3 7-7" stroke="var(--art-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </>}
  </svg>
}
