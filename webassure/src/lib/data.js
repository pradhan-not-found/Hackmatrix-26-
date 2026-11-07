// Demo data for the dashboard. Replace with API calls when the backend is ready.

export const DAYS = ['Oct 25', 'Oct 26', 'Oct 27', 'Oct 28', 'Oct 29', 'Oct 30', 'Oct 31', 'Nov 1', 'Nov 2', 'Nov 3', 'Nov 4', 'Nov 5', 'Nov 6', 'Nov 7']
export const SCANS_PER_DAY = [182, 205, 196, 240, 228, 251, 219, 264, 292, 277, 310, 298, 336, 351]

export const CATEGORIES = [
  ['Phishing', 142],
  ['Brand impersonation', 96],
  ['Fake recruitment', 58],
  ['Payment scam', 41],
  ['Malicious redirect', 27],
]

export const THREATS = [
  { id: 'T-2207', name: 'SBI KYC phishing kit', type: 'Phishing', targets: 'SBI customers', urls: 14, first: 'Nov 5', status: 'Active' },
  { id: 'T-2206', name: 'Infosys fake offer letters', type: 'Fake recruitment', targets: 'Job seekers', urls: 6, first: 'Nov 4', status: 'Active' },
  { id: 'T-2205', name: 'Aadhaar update OTP scam', type: 'Government', targets: 'Citizens', urls: 9, first: 'Nov 2', status: 'Mitigated' },
  { id: 'T-2204', name: 'Amazon refund lure', type: 'Impersonation', targets: 'Shoppers', urls: 11, first: 'Oct 30', status: 'Active' },
  { id: 'T-2203', name: 'Courier re-delivery fee', type: 'Payment scam', targets: 'Shoppers', urls: 4, first: 'Oct 28', status: 'Taken down' },
  { id: 'T-2202', name: 'Fake university fee portal', type: 'Phishing', targets: 'Students', urls: 3, first: 'Oct 26', status: 'Taken down' },
]

export const CERTS = [
  { host: '*.portal-login.in', issuer: 'Unverified Intermediate CA', expires: 'Feb 3, 2027', days: 88, key: 'RSA 1024', ct: false, status: 'bad' },
  { host: 'mail.example-bank.co', issuer: "Let's Encrypt R11", expires: 'Nov 13, 2026', days: 6, key: 'ECDSA P-256', ct: true, status: 'warn' },
  { host: 'api.webassure.dev', issuer: 'Google Trust Services WE1', expires: 'Jun 7, 2027', days: 212, key: 'ECDSA P-256', ct: true, status: 'ok' },
  { host: 'shop.mybrand.in', issuer: 'DigiCert Global G2', expires: 'Feb 3, 2027', days: 88, key: 'RSA 2048', ct: true, status: 'ok' },
  { host: 'pay.mybrand.in', issuer: 'DigiCert Global G2', expires: 'Mar 19, 2027', days: 132, key: 'RSA 2048', ct: true, status: 'ok' },
]

export const REPORTS = [
  { id: 'R-0311', title: 'Weekly threat summary', range: 'Oct 31 – Nov 6', type: 'Summary', created: 'Nov 7' },
  { id: 'R-0310', title: 'SBI impersonation campaign', range: 'Nov 5 – Nov 7', type: 'Investigation', created: 'Nov 7' },
  { id: 'R-0309', title: 'Certificate health', range: 'October 2026', type: 'Certificates', created: 'Nov 1' },
  { id: 'R-0308', title: 'Weekly threat summary', range: 'Oct 24 – Oct 30', type: 'Summary', created: 'Oct 31' },
]

export const LEDGER = [
  { id: '#4821', url: 'secure-sbi-kyc-update.xyz', confirmations: 12, tx: '0x9f3a…c21e', block: '18,204,551', status: 'Anchored', when: '4 min ago' },
  { id: '#4820', url: 'careers-infosys.work', confirmations: 3, tx: '0x41bd…07a9', block: '—', status: 'Pending', when: '22 min ago' },
  { id: '#4819', url: 'aadhaar-update-portal.in', confirmations: 9, tx: '0x7c02…e5f1', block: '18,204,310', status: 'Anchored', when: '5 h ago' },
  { id: '#4818', url: 'amazon-refund-help.top', confirmations: 15, tx: '0xd2e8…19bc', block: '18,203,977', status: 'Anchored', when: 'Yesterday' },
  { id: '#4817', url: 'cdn-update-check.net', confirmations: 2, tx: '0x08aa…f3d4', block: '—', status: 'Disputed', when: 'Yesterday' },
]
