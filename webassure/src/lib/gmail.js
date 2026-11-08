import { emailApi } from './email.js'

// Inbox protection shared by Settings and the dashboard-wide fraud alert.
export const FRAUD = new Set(['PHISHING', 'SCAM'])
export const gmailLink = (id, email) => `https://mail.google.com/mail/?authuser=${encodeURIComponent(email || '')}#inbox/${encodeURIComponent(id)}`

let latest = null
export const latestScan = () => latest

function publish(result) {
  latest = result
  window.dispatchEvent(new CustomEvent('wa-gmail-scan', { detail: result }))
}

export const gmailStatus = () => emailApi('gmail/status')
export const gmailAuthorize = () => emailApi('gmail/auth')

export async function scanInbox() {
  const result = await emailApi('gmail/scan', { method: 'POST' })
  publish(result)
  return result
}

export async function disconnectGmail() {
  await emailApi('gmail/disconnect', { method: 'POST' })
  publish(null)
}

export const announceGmailConnected = () => window.dispatchEvent(new Event('wa-gmail-connected'))

const dismissedKey = (userId) => `wa-gmail-dismissed:${userId}`

export function dismissedAlerts(userId) {
  try { return new Set(JSON.parse(localStorage.getItem(dismissedKey(userId))) || []) } catch { return new Set() }
}

export function dismissAlerts(userId, ids) {
  const next = [...new Set([...dismissedAlerts(userId), ...ids])].slice(-300)
  try { localStorage.setItem(dismissedKey(userId), JSON.stringify(next)) } catch {}
}
