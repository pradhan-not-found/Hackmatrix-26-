// Subscription plans (demo billing). The chosen plan is stored per user in the
// browser until a real billing provider is connected.

export const PLANS = {
  personal: {
    id: 'personal', name: 'Personal', monthly: 0, blurb: 'Check links before you trust them.',
    limits: { checks: 50, messages: 30, domains: 1 },
    features: ['50 link checks a month', '30 message analyses a month', 'Plain-language risk reports', '1 monitored domain'],
  },
  pro: {
    id: 'pro', name: 'Pro', monthly: 499, blurb: 'For professionals and small businesses.', popular: true,
    limits: { checks: Infinity, messages: 500, domains: 10 },
    features: ['Unlimited link checks', '500 message analyses a month', 'Certificate monitoring for 10 domains', 'Evidence export and instant alerts', 'Submit to the threat ledger'],
  },
  teams: {
    id: 'teams', name: 'Teams', monthly: 2499, blurb: 'For security teams protecting a brand.',
    limits: { checks: Infinity, messages: Infinity, domains: Infinity },
    features: ['Everything in Pro', 'Unlimited message analyses', 'Unlimited certificate monitoring', 'REST API and webhooks', 'SSO, roles and priority support'],
  },
}

export const ORDER = ['personal', 'pro', 'teams']

export const priceFor = (plan, cycle) => (cycle === 'yearly' ? Math.round((plan.monthly * 10) / 12) : plan.monthly)
export const chargeFor = (plan, cycle) => (cycle === 'yearly' ? plan.monthly * 10 : plan.monthly)
export const inr = (n) => `₹${n.toLocaleString('en-IN')}`

const key = (userId) => `wa-plan:${userId || 'me'}`

export function getPlan(userId) {
  try {
    const saved = JSON.parse(localStorage.getItem(key(userId)))
    if (saved && PLANS[saved.id]) return saved
  } catch {}
  return { id: 'personal', cycle: 'monthly', since: null, renews: null }
}

export function setPlan(userId, id, cycle) {
  const since = new Date()
  const renews = new Date(since)
  if (cycle === 'yearly') renews.setFullYear(renews.getFullYear() + 1)
  else renews.setMonth(renews.getMonth() + 1)
  const record = { id, cycle, since: since.toISOString(), renews: renews.toISOString() }
  try { localStorage.setItem(key(userId), JSON.stringify(record)) } catch {}
  window.dispatchEvent(new CustomEvent('wa-plan-change', { detail: record }))
  return record
}
