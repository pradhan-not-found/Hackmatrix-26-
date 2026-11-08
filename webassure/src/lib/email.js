import { getSupabase } from './auth.js'

export const MAX_EMAIL_BYTES = 500000
export const emailTone = (classification) => ({ SAFE: 'ok', SUSPICIOUS: 'warn', SCAM: 'bad', PHISHING: 'bad' })[classification] || 'neutral'
export const emailLabel = (classification) => ({ SAFE: 'No significant indicators', SUSPICIOUS: 'Needs review', SCAM: 'Likely scam', PHISHING: 'Phishing indicators' })[classification] || 'Assessment unavailable'

export async function emailApi(path, options = {}) {
  const { data, error } = await getSupabase().auth.getSession()
  if (error) throw error
  if (!data.session) throw new Error('Your session has expired. Sign in again.')
  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${data.session.access_token}`)
  let response
  try { response = await fetch(`/api/email/${path}`, { cache: 'no-store', ...options, headers }) }
  catch { throw new Error('Cannot reach the email analysis service. Check your connection and retry.') }
  const result = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = result?.detail
    throw new Error(typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((item) => item.msg).join('; ') : 'Email analysis failed. Please retry.')
  }
  if (!result) throw new Error('The email service returned an empty response.')
  return result
}
