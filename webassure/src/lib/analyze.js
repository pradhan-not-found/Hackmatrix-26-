// Client-side heuristic preview. A real deployment calls the WebAssure API
// (ML model, TLS / CT-log checks, reputation feeds) instead.
const RISKY_TLDS = ['zip', 'mov', 'xyz', 'top', 'click', 'country', 'gq', 'tk', 'ml', 'cf', 'work', 'support', 'rest']
const BRANDS = ['paypal', 'sbi', 'hdfc', 'icici', 'paytm', 'amazon', 'microsoft', 'apple', 'google', 'netflix', 'aadhaar']
const LURES = ['login', 'verify', 'secure', 'update', 'account', 'wallet', 'kyc', 'reward', 'refund', 'otp', 'signin', 'confirm']

export function analyze(raw) {
  const input = raw.trim()
  const hasScheme = /^[a-z]+:\/\//i.test(input)
  let url
  try {
    url = new URL(hasScheme ? input : `https://${input}`)
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase()
  if (!host.includes('.')) return null
  const labels = host.split('.')
  const tld = labels.at(-1)
  const full = url.href.toLowerCase()
  const findings = []
  const add = (weight, text) => findings.push({ weight, text })

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) add(30, 'Host is a raw IP address, not a domain')
  if (host.includes('xn--')) add(25, 'Punycode domain: possible look-alike characters')
  if (hasScheme && url.protocol === 'http:') add(15, 'Served over plain HTTP, no TLS')
  if (input.includes('@')) add(20, '"@" in the URL can hide the real destination')
  if (labels.length > 4) add(12, `Deep subdomain chain (${labels.length - 2} levels)`)
  if (RISKY_TLDS.includes(tld)) add(15, `.${tld} is a top-level domain often abused for phishing`)
  if ((host.match(/-/g) || []).length >= 2) add(10, 'Multiple hyphens in hostname')
  if (full.length > 90) add(8, 'Unusually long URL')
  const owner = labels.at(-2)
  const brand = BRANDS.find((b) => full.includes(b) && owner !== b && tld !== b)
  if (brand) add(22, `Mentions "${brand}" but is not on ${brand}'s own domain`)
  const lure = LURES.filter((l) => full.includes(l))
  if (lure.length) add(6 * Math.min(lure.length, 3), `Credential-lure words: ${lure.slice(0, 3).join(', ')}`)

  const risk = Math.min(100, findings.reduce((s, f) => s + f.weight, 0))
  const verdict = risk >= 55 ? 'High risk' : risk >= 25 ? 'Suspicious' : 'Low risk'
  const tone = risk >= 55 ? 'var(--heat-pink)' : risk >= 25 ? 'var(--heat-blue)' : 'var(--heat-green)'
  if (!findings.length) findings.push({ weight: 0, text: 'No structural red flags in the URL itself' })
  return { host, risk, verdict, tone, findings: findings.sort((a, b) => b.weight - a.weight) }
}
