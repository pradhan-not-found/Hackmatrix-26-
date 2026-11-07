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

// Merge changes into the stored profile (keeps fields like the avatar intact).
export function updateUser(patch) {
  const user = { ...(getUser() || {}), ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(user))
  } catch {
    return null // storage full (e.g. very large image)
  }
  return user
}

export function signOut() {
  try {
    localStorage.removeItem(KEY)
  } catch {}
}
