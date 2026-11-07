// Proxies message analysis to the FastAPI backend (same sign-in rule as investigations).
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_BODY = 12000 // backend accepts up to 10,000 characters of message text

export async function POST(request) {
  const authorization = request.headers.get('authorization')
  if (!/^Bearer\s+\S+$/i.test(authorization || '')) {
    return Response.json({ detail: 'Sign in to analyse messages.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }
  const raw = await request.text()
  if (raw.length > MAX_BODY) return Response.json({ detail: 'Message is too long. Keep it under 10,000 characters.' }, { status: 413 })
  let body
  try { body = JSON.stringify({ message: String(JSON.parse(raw).message ?? '') }) }
  catch { return Response.json({ detail: 'Request must be valid JSON.' }, { status: 400 }) }

  const provider = new URL(request.url).searchParams.get('provider') === 'gemini' ? 'gemini' : 'local'
  try {
    const base = (process.env.BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
    const upstream = new URL(`${base}/api/analyze-message`)
    upstream.searchParams.set('provider', provider)
    const response = await fetch(upstream, {
      method: 'POST', body, cache: 'no-store', redirect: 'error',
      headers: { 'Content-Type': 'application/json', Authorization: authorization },
      signal: AbortSignal.timeout(60000),
    })
    return new Response(await response.text(), {
      status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    const timeout = error.name === 'TimeoutError'
    return Response.json({ detail: timeout ? 'The analysis timed out. Please try again.' : 'Cannot reach the analysis service. Start FastAPI and try again.' },
      { status: timeout ? 504 : 502 })
  }
}
