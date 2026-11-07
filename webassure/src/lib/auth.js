// Demo-only session handling. Replace with a real auth provider before launch.
const KEY = 'wa-user'

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem(KEY))
  } catch {
    return null
  }
}

export function signIn(email, name) {
  const user = { email, name: name || email.split('@')[0] }
  try {
    localStorage.setItem(KEY, JSON.stringify(user))
  } catch {}
  return user
}

export function signOut() {
  try {
    localStorage.removeItem(KEY)
  } catch {}
}
