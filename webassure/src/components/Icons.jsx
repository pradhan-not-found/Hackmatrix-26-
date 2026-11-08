'use client'

const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export const ThemeIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
  </svg>
)
export const GridIcon = () => (
  <svg {...base}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg>
)
export const ScanIcon = () => (
  <svg {...base}><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16" /></svg>
)
export const ShieldIcon = () => (
  <svg {...base}><path d="M12 3l7 3v5.5c0 4.3-3 8-7 9.5-4-1.5-7-5.2-7-9.5V6l7-3z" /><path d="M9 12l2 2 4-4" /></svg>
)
export const LockIcon = () => (
  <svg {...base}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
)
export const FileIcon = () => (
  <svg {...base}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>
)
export const LedgerIcon = () => (
  <svg {...base}><rect x="3" y="4" width="7" height="7" rx="1.5" /><rect x="14" y="13" width="7" height="7" rx="1.5" /><path d="M10 7.5h4a2 2 0 0 1 2 2V13" /></svg>
)
export const SettingsIcon = () => (
  <svg {...base}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
)
export const LogoutIcon = () => (
  <svg {...base}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" /></svg>
)
export const ArrowIcon = () => (
  <svg {...base}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
)
export const CheckIcon = () => (
  <svg {...base}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
)
export const AlertIcon = () => (
  <svg {...base}><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17.5v.01" /></svg>
)
export const SearchIcon = () => (
  <svg {...base}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4-4" /></svg>
)
export const GlobeIcon = () => (
  <svg {...base}><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18M5 6.5h14M5 17.5h14" /></svg>
)
export const RouteIcon = () => (
  <svg {...base}><circle cx="5" cy="5" r="2" /><circle cx="19" cy="19" r="2" /><path d="M7 5h8a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h6M16 16l3 3-3 3" /></svg>
)
export const InfoIcon = () => (
  <svg {...base}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7v.01" /></svg>
)
export const DownloadIcon = () => (
  <svg {...base}><path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4" /></svg>
)
export const CloseIcon = () => (
  <svg {...base}><path d="m6 6 12 12M18 6 6 18" /></svg>
)

export const MailIcon = () => (
  <svg {...base}><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" /><path d="M22 6l-10 7L4 6" /></svg>
)

export const GmailIcon = () => (
  <svg {...base}><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" /><path d="M22 6l-10 7L4 6" /></svg>
)

export const LinkIcon = () => (
  <svg {...base}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
)

export const ShieldCheckIcon = () => (
  <svg {...base}><path d="M12 3l7 3v5.5c0 4.3-3 8-7 9.5-4-1.5-7-5.2-7-9.5V6l7-3z" /><path d="M9 12l2 2 4-4" /></svg>
)

export const AlertTriangleIcon = () => (
  <svg {...base}><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17.5v.01" /></svg>
)

export const LoaderIcon = () => (
  <svg {...base} style={{ animation: 'spin 1s linear infinite' }}><circle cx="12" cy="12" r="10" strokeOpacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" /></svg>
)

export const XIcon = () => (
  <svg {...base}><path d="M18 6L6 18M6 6l12 12" /></svg>
)

// Neutral silhouette used until a real photo is added.
export const PersonPlaceholder = () => (
  <svg viewBox="0 0 64 64" aria-hidden="true" className="person-ph">
    <circle cx="32" cy="24" r="11" fill="currentColor" />
    <path d="M10 60c0-12.2 9.8-20 22-20s22 7.8 22 20z" fill="currentColor" />
  </svg>
)
