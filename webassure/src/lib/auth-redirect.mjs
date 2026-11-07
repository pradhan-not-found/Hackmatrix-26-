export function dashboardPath(value) {
  return typeof value === 'string' && /^\/dashboard(?:[/?#]|$)/.test(value) && !value.includes('\\') ? value : '/dashboard'
}
