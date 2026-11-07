import { getSupabase } from './auth.js'

export async function api(path = '', options = {}) {
  const { data: auth, error } = await getSupabase().auth.getSession()
  if (error) throw error
  if (!auth.session) throw new Error('Your session has expired. Sign in again.')
  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${auth.session.access_token}`)
  let response
  try { response = await fetch(`/api/investigations${path}`, { cache: 'no-store', ...options, headers }) }
  catch { throw new Error('Cannot reach the investigation service. Check your connection and retry.') }
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = data?.detail
    throw new Error(typeof detail === 'string' ? detail : Array.isArray(detail)
      ? detail.map((item) => item.msg).join('; ') : `Investigation request failed (HTTP ${response.status}).`)
  }
  if (!data) throw new Error('The investigation service returned an empty response.')
  return data
}

export const classificationTone = (classification) => ({
  'Confirmed Malicious': 'bad', 'High Risk': 'bad', Suspicious: 'warn', 'Low Risk': 'ok',
}[classification] || 'neutral')

export function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unavailable' : date.toLocaleString()
}

export function downloadReport(report) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `investigation-${report.id}.json`
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
