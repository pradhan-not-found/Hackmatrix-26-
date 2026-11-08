import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { after, before, test } from 'node:test'
import { proxy as GET, proxy as POST } from '../src/lib/investigation-proxy.mjs'

let server
let base
let received
const previous = process.env.BACKEND_URL
function authorizedRequest(url, options = {}) {
  return new Request(url, { ...options, headers: { ...options.headers, Authorization: 'Bearer test-session-token' } })
}

before(async () => {
  server = createServer(async (request, response) => {
    let body = ''
    for await (const chunk of request) body += chunk
    received = { url: request.url, method: request.method, body, authorization: request.headers.authorization }
    response.writeHead(request.method === 'POST' ? 201 : 200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify(request.method === 'POST' ? { id: 'saved-report' } : { items: [], total: 0 }))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}`
  process.env.BACKEND_URL = base
})
after(async () => {
  if (previous === undefined) delete process.env.BACKEND_URL
  else process.env.BACKEND_URL = previous
  await new Promise((resolve) => server.close(resolve))
})

test('history forwards pagination, disables caching and strips unrelated query parameters', async () => {
  const response = await GET(authorizedRequest('http://local/api/investigations?limit=5&offset=2&other=x'), { params: {} })
  assert.equal(response.status, 200)
  assert.equal(received.url, '/api/investigations?limit=5&offset=2')
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
  assert.equal(received.authorization, 'Bearer test-session-token')
})

test('submission reaches the backend and preserves its response status', async () => {
  const response = await POST(authorizedRequest('http://local/api/investigations', { method: 'POST', body: JSON.stringify({ url: 'example.com' }) }), { params: {} })
  assert.equal(response.status, 201)
  assert.equal(received.method, 'POST')
  assert.deepEqual(JSON.parse(received.body), { url: 'example.com' })
  assert.equal((await response.json()).id, 'saved-report')
})

test('detail requests accept only an investigation UUID', async () => {
  const id = '00000000-0000-0000-0000-000000000001'
  await GET(authorizedRequest('http://local/api/investigations/' + id), { params: { path: [id] } })
  assert.equal(received.url, '/api/investigations/' + id)
  const bad = await GET(new Request('http://local/api/investigations/bad'), { params: { path: ['bad'] } })
  assert.equal(bad.status, 404)
})

test('insights forward only an allowed provider and require authenticated POST', async () => {
  const id = '00000000-0000-0000-0000-000000000001'
  const params = { path: [id, 'explanation'] }
  const url = `http://local/api/investigations/${id}/explanation?provider=gemini&secret=discard`
  const result = await POST(authorizedRequest(url, { method: 'POST' }), { params })
  assert.equal(result.status, 201)
  assert.equal(received.url, `/api/investigations/${id}/explanation?provider=gemini`)
  assert.equal(received.body, '')
  assert.equal((await GET(authorizedRequest(url), { params })).status, 405)
  assert.equal((await POST(new Request(url, { method: 'POST' }), { params })).status, 401)
  assert.equal((await POST(authorizedRequest(url.replace('provider=gemini', 'provider=other'), { method: 'POST' }), { params })).status, 400)
})

test('malformed and oversized submissions are rejected', async () => {
  for (const [body, status] of [['{', 400], ['x'.repeat(8193), 413]]) {
    const response = await POST(authorizedRequest('http://local/api/investigations', { method: 'POST', body }), { params: {} })
    assert.equal(response.status, status)
  }
})

test('unreachable backend produces an actionable error', async () => {
  process.env.BACKEND_URL = 'http://127.0.0.1:1'
  try {
    const response = await GET(authorizedRequest('http://local/api/investigations'), { params: {} })
    assert.equal(response.status, 502)
    assert.match((await response.json()).detail, /Start FastAPI/)
  } finally { process.env.BACKEND_URL = base }
})

test('missing or malformed authorization is rejected before contacting the backend', async () => {
  const previousRequest = received
  for (const authorization of ['', 'Basic anything', 'Bearer ']) {
    const response = await GET(new Request('http://local/api/investigations', { headers: { authorization } }), { params: {} })
    assert.equal(response.status, 401)
    assert.equal(received, previousRequest)
  }
})
