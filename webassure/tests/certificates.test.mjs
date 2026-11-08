import test from 'node:test'
import assert from 'node:assert/strict'
import { certificateRows } from '../src/lib/certificates.mjs'

const stamp = Date.parse('2026-11-08T00:00:00Z')
const tls = { verified: true, certificate: { not_after: '2027-01-01T00:00:00Z', public_key: { status: 'acceptable' }, signature: { status: 'acceptable' } } }
const report = { id: 'old', created_at: '2026-11-01T00:00:00Z', normalized_url: 'https://example.com/', redirect_chain: [{ url: 'https://example.com/', tls }] }

test('real certificate snapshots distinguish supported, incomplete, weak and expired results', () => {
  const row = (value) => certificateRows([{ ...report, redirect_chain: [{ url: report.normalized_url, tls: value }] }], stamp)[0]
  assert.equal(row(tls).status, 'ok')
  assert.equal(row({ verified: true }).label, 'Checks incomplete')
  assert.equal(row({ ...tls, certificate: { ...tls.certificate, public_key: { status: 'weak' } } }).status, 'bad')
  assert.equal(row({ ...tls, certificate: { ...tls.certificate, not_after: '2026-11-10T00:00:00Z' } }).label, 'Expiring soon')
  assert.equal(row({ ...tls, certificate: { ...tls.certificate, not_after: '2026-11-07T23:59:59Z' } }).label, 'Expired')
})

test('latest failed observation replaces earlier successful data and redirect hosts remain separate', () => {
  const newer = { id: 'new', normalized_url: report.normalized_url, created_at: '2026-11-08T00:00:00Z', checks: [{ name: 'tls', status: 'failed', url: report.normalized_url, error: 'certificate expired' }] }
  const rows = certificateRows([newer, report], stamp)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].reportId, 'new')
  assert.equal(rows[0].label, 'Verification failed')
  const redirected = { ...report, redirect_chain: [...report.redirect_chain, { url: 'https://destination.example/', tls }] }
  assert.equal(certificateRows([redirected], stamp).length, 2)
})
