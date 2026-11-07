// Sidebar icon set: one consistent 24px grid, 1.75 stroke, rounded joins.
const I = ({ children }) => (
  <svg className="nav-ic" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)

export const OverviewIcon = () => (
  <I><rect x="3.5" y="3.5" width="7" height="9" rx="2" /><rect x="13.5" y="3.5" width="7" height="5" rx="2" /><rect x="13.5" y="11.5" width="7" height="9" rx="2" /><rect x="3.5" y="15.5" width="7" height="5" rx="2" /></I>
)
export const ScansIcon = () => (
  <I><path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><circle cx="11.5" cy="11.5" r="3.5" /><path d="m14 14 2.5 2.5" /></I>
)
export const ThreatsIcon = () => (
  <I><path d="M12 3.5 19 6v5.5c0 4.3-2.9 7.6-7 9-4.1-1.4-7-4.7-7-9V6l7-2.5Z" /><path d="M12 8.5v4" /><path d="M12 15.6h.01" /></I>
)
export const CertificatesIcon = () => (
  <I><path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h4" /><path d="M13.5 3.5V8H18" /><path d="M18 8v2.5" /><rect x="13" y="14.5" width="7.5" height="6" rx="1.5" /><path d="M14.75 14.5v-1.6a2 2 0 0 1 4 0v1.6" /><path d="M8.5 11h5M8.5 14.5h2.5" /></I>
)
export const ReportsIcon = () => (
  <I><path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8Z" /><path d="M14 3.5V8h4.5" /><path d="M9 13h6M9 16.5h4" /></I>
)
export const LedgerIcon = () => (
  <I><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="13.5" width="7" height="7" rx="2" /><path d="M10.5 7h3a3 3 0 0 1 3 3v3.5" /><path d="M13.5 17h-3a3 3 0 0 1-3-3v-3.5" /></I>
)
export const SettingsIcon = () => (
  <I><path d="M12 3.5 14 5h2.6l.9 2.4L20 9l-.6 2.6L20 14l-2.5 1.6-.9 2.4H14L12 20.5 10 19H7.4l-.9-2.4L4 15l.6-2.6L4 10l2.5-1.6.9-2.4H10Z" /><circle cx="12" cy="12" r="3" /></I>
)
export const LogoutIcon = () => (
  <I><path d="M15 4h2.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H15" /><path d="M10 16.5 14.5 12 10 7.5" /><path d="M14.5 12H4" /></I>
)
export const MessagesIcon = () => (
  <I><path d="M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-4 3.5v-3.5H6.5a2 2 0 0 1-2-2Z" /><path d="M8.5 9h7M8.5 12h4.5" /></I>
)
