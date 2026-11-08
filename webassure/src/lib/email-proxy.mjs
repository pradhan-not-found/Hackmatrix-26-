const MAX_EMAIL_BYTES = 500000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const error = (detail, status) => Response.json({ detail }, { status, headers: { 'Cache-Control': 'no-store' } })

async function limitedBody(request, max) {
  const reader = request.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > max) { await reader.cancel(); throw Object.assign(new Error('Email request is too large.'), { status: 413 }) }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const result = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength }
  return result
}

export async function emailProxy(request, { params }) {
  const path = params.path || []
  const create = path.length === 1 && ['analyze', 'upload'].includes(path[0])
  const read = path[0] === 'results' && (path.length === 1 || (path.length === 2 && UUID.test(path[1])))
  if (!create && !read) return error('Unknown email endpoint.', 404)
  if (request.method !== (create ? 'POST' : 'GET')) return error('Method not allowed.', 405)
  const authorization = request.headers.get('authorization')
  if (!/^Bearer\s+\S+$/i.test(authorization || '')) return error('Sign in to analyse emails.', 401)
  let body
  const headers = { Authorization: authorization }
  try {
    if (create && path[0] === 'analyze') {
      let input
      try { input = JSON.parse(new TextDecoder().decode(await limitedBody(request, 3100000))) }
      catch (failure) { return error(failure.status ? failure.message : 'Request must be valid JSON.', failure.status || 400) }
      const fields = ['email_content', 'raw_headers'].filter((name) => typeof input?.[name] === 'string' && input[name].trim())
      if (fields.length !== 1) return error('Provide exactly one email or header block.', 422)
      const field = fields[0]
      if (new TextEncoder().encode(input[field]).byteLength > MAX_EMAIL_BYTES) return error('Email exceeds the 500 KB limit.', 413)
      body = JSON.stringify({ [field]: input[field], use_gemini: input.use_gemini === true })
      headers['Content-Type'] = 'application/json'
    } else if (create) {
      const raw = await limitedBody(request, MAX_EMAIL_BYTES + 131072)
      let form
      try { form = await new Response(raw, { headers: { 'Content-Type': request.headers.get('content-type') || '' } }).formData() }
      catch { return error('Choose a valid .eml file.', 422) }
      const file = form.get('file')
      if (!file || typeof file === 'string' || !/\.eml$/i.test(file.name)) return error('Only .eml files are supported.', 422)
      if (!file.size || file.size > MAX_EMAIL_BYTES) return error('Choose a nonempty .eml file no larger than 500 KB.', 413)
      body = new FormData()
      body.set('file', file, file.name)
      body.set('use_gemini', form.get('use_gemini') === 'true' ? 'true' : 'false')
    }
    const base = (process.env.BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
    const upstream = new URL(`${base}/api/email/${path.join('/')}`)
    if (read && path.length === 1) {
      const query = new URL(request.url).searchParams
      for (const key of ['limit', 'offset']) if (query.has(key)) upstream.searchParams.set(key, query.get(key))
    }
    const response = await fetch(upstream, { method: request.method, body, headers, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(300000) })
    return new Response(await response.text(), { status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
  } catch (failure) {
    if (failure.status) return error(failure.message, failure.status)
    return error(failure.name === 'TimeoutError' ? 'Email analysis timed out. Refresh saved results before retrying; analysis may still finish.' : 'Cannot reach the email analysis backend. Start FastAPI and retry.', failure.name === 'TimeoutError' ? 504 : 502)
  }
}
