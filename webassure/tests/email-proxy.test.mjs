import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { emailProxy } from '../src/lib/email-proxy.mjs'

let server, received
const previous = process.env.BACKEND_URL
before(async () => {
  server = createServer(async (request, response) => {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    received = { url: request.url, method: request.method, headers: request.headers, body: Buffer.concat(chunks).toString() }
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ id: 'test-report' }))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  process.env.BACKEND_URL = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  if (previous === undefined) delete process.env.BACKEND_URL
  else process.env.BACKEND_URL = previous
  await new Promise((resolve) => server.close(resolve))
})
const send = (path, options = {}, signed = true) => emailProxy(new Request(`http://local/api/email/${path}`, {
  ...options, headers: { ...(signed ? { Authorization: 'Bearer test-session' } : {}), ...options.headers },
}), { params: { path: path.split('?')[0].split('/') } })
const json = (value) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) })

test('email JSON requests forward exactly one input and default AI off', async () => {
  assert.equal((await send('analyze', json({ email_content: 'Subject: Test\n\nHello', user_id: 'forged' }))).status, 200)
  assert.equal(received.url, '/api/email/analyze')
  assert.equal(received.headers.authorization, 'Bearer test-session')
  assert.deepEqual(JSON.parse(received.body), { email_content: 'Subject: Test\n\nHello', use_gemini: false })
  await send('analyze', json({ raw_headers: 'From: user@example.com', use_gemini: true }))
  assert.equal(JSON.parse(received.body).use_gemini, true)
})

test('email proxy rejects invalid inputs and counts UTF-8 bytes', async () => {
  for (const input of [{}, { email_content: 'a', raw_headers: 'b' }]) assert.equal((await send('analyze', json(input))).status, 422)
  assert.equal((await send('analyze', json({ email_content: 'é'.repeat(250001) }))).status, 413)
  assert.equal((await send('analyze', { method: 'POST', body: '{' })).status, 400)
})

test('eml upload preserves multipart payload and refuses other files', async () => {
  const form = new FormData()
  form.set('file', new Blob(['From: user@example.com\nSubject: Upload\n\nHello'], { type: 'message/rfc822' }), 'email.eml')
  form.set('use_gemini', 'false')
  assert.equal((await send('upload', { method: 'POST', body: form })).status, 200)
  assert.match(received.headers['content-type'], /multipart\/form-data; boundary=/)
  assert.match(received.body, /filename="email.eml"/)
  assert.match(received.body, /Subject: Upload/)
  const bad = new FormData(); bad.set('file', new Blob(['test']), 'malware.exe')
  assert.equal((await send('upload', { method: 'POST', body: bad })).status, 422)
})

test('history forwards pagination only, blocks unauthenticated calls and unsupported routes', async () => {
  const response = await send('results?limit=10&offset=5&user_id=other')
  assert.equal(received.url, '/api/email/results?limit=10&offset=5')
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
  assert.equal((await send('results', {}, false)).status, 401)
  assert.equal((await send('gmail/messages')).status, 404)
  assert.equal((await send('results/not-a-uuid')).status, 404)
  assert.equal((await send('results', { method: 'POST' })).status, 405)
})
