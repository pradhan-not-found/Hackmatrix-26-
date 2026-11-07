export async function proxy(request, { params }) {
  const path = params.path || []
  const validId = path.length === 1 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(path[0])
  if (path.length && !validId) return Response.json({ detail: 'Unknown investigation endpoint.' }, { status: 404 })
  if (request.method === 'POST' && path.length) return Response.json({ detail: 'Method not allowed.' }, { status: 405 })
  const authorization = request.headers.get('authorization')
  if (!/^Bearer\s+\S+$/i.test(authorization || '')) return Response.json({ detail: 'Sign in to access investigations.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  try {
    const base = (process.env.BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
    const upstream = new URL(`${base}/api/investigations${path.length ? `/${path[0]}` : ''}`)
    if (request.method === 'GET' && !path.length) {
      const query = new URL(request.url).searchParams
      for (const name of ['limit', 'offset']) if (query.has(name)) upstream.searchParams.set(name, query.get(name))
    }
    let body
    if (request.method === 'POST') {
      const raw = await request.text()
      if (raw.length > 8192) return Response.json({ detail: 'Request too large.' }, { status: 413 })
      try { body = JSON.stringify(JSON.parse(raw)) }
      catch { return Response.json({ detail: 'Request must be valid JSON.' }, { status: 400 }) }
    }
    const response = await fetch(upstream, {
      method: request.method, body, cache: 'no-store', redirect: 'error',
      headers: { 'Content-Type': 'application/json', Authorization: authorization }, signal: AbortSignal.timeout(90000),
    })
    return new Response(await response.text(), {
      status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    const timeout = error.name === 'TimeoutError'
    return Response.json({ detail: timeout
      ? 'The investigation timed out. Check saved history before retrying; the backend may still finish.'
      : 'Cannot reach the investigation backend. Start FastAPI and try again.' }, { status: timeout ? 504 : 502 })
  }
}
