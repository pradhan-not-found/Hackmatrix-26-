import { createClient } from '@supabase/supabase-js'
import { dashboardPath } from './auth-redirect.mjs'
export { dashboardPath } from './auth-redirect.mjs'

let client
export function getSupabase() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if (!url || !key) throw new Error('Sign-in is not configured. Set the Supabase environment variables and restart the app.')
    client = createClient(url, key, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  }
  return client
}

function profile(user) {
  if (!user) return null
  const metadata = user.user_metadata || {}
  return { id: user.id, email: user.email, name: metadata.name || metadata.full_name || user.email?.split('@')[0] || 'User',
    avatar: Object.hasOwn(metadata, 'avatar') ? metadata.avatar : metadata.avatar_url || metadata.picture || null,
    preferences: metadata.preferences || { high: true, certs: true, weekly: false } }
}

export async function getUser() {
  const { data, error } = await getSupabase().auth.getUser()
  if (error) {
    if (error.name === 'AuthSessionMissingError') return null
    throw error
  }
  return profile(data.user)
}

export function watchAuth(callback) {
  const { data } = getSupabase().auth.onAuthStateChange((_event, session) => callback(profile(session?.user)))
  return () => data.subscription.unsubscribe()
}

export async function signIn(email, password) {
  const { data, error } = await getSupabase().auth.signInWithPassword({ email, password })
  if (error) throw error
  return profile(data.user)
}

export async function signUp(email, password, name, next) {
  const callback = new URL('/auth/callback', window.location.origin)
  callback.searchParams.set('next', dashboardPath(next))
  const { data, error } = await getSupabase().auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: callback.href } })
  if (error) throw error
  return { user: profile(data.user), session: data.session }
}

export async function signInWithProvider(provider, next) {
  const callback = new URL('/auth/callback', window.location.origin)
  callback.searchParams.set('next', dashboardPath(next))
  const { error } = await getSupabase().auth.signInWithOAuth({ provider, options: { redirectTo: callback.href } })
  if (error) throw error
}

export async function updateUser(patch) {
  const { data, error } = await getSupabase().auth.updateUser({ data: patch })
  if (error) throw error
  return profile(data.user)
}

export async function uploadAvatar(blob) {
  const user = await getUser()
  if (!user) throw new Error('Sign in to update your photo.')
  const path = `${user.id}/profile.jpg`
  const storage = getSupabase().storage.from('avatars')
  const { error } = await storage.upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '0' })
  if (error) throw error
  const { data } = storage.getPublicUrl(path)
  return updateUser({ avatar: `${data.publicUrl}?v=${Date.now()}` })
}

export async function removeAvatar() {
  const user = await getUser()
  if (!user) throw new Error('Sign in to update your photo.')
  const { error } = await getSupabase().storage.from('avatars').remove([`${user.id}/profile.jpg`])
  if (error) throw error
  return updateUser({ avatar: null })
}

export async function resetPassword(email) {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
    redirectTo: new URL('/auth/reset-password', window.location.origin).href,
  })
  if (error) throw error
}

export async function updatePassword(password) {
  const { error } = await getSupabase().auth.updateUser({ password })
  if (error) throw error
}

export async function signOut() {
  const { error } = await getSupabase().auth.signOut()
  if (error) throw error
  localStorage.removeItem('wa-user')
}
