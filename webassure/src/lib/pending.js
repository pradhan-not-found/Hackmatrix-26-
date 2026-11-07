// A link submitted from the landing page, waiting for the dashboard to scan it.
const KEY = 'wa-pending-scan'

export function setPendingScan(url) {
  try {
    sessionStorage.setItem(KEY, url)
  } catch {}
}

export function takePendingScan() {
  try {
    const url = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    return url
  } catch {
    return null
  }
}
