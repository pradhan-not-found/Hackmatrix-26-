import assert from 'node:assert/strict'
import test from 'node:test'
import { correlateReports } from '../src/lib/correlation.mjs'

const fixture = (id, url, classification = 'Low Risk', hops = []) => ({ id, normalized_url: url,
  risk_classification: classification, created_at: `2026-11-08T0${id}:00:00Z`, redirect_chain: hops })
const fingerprint = 'ab'.repeat(32)
const hop = (url, verified = true) => ({ url, tls: { verified, certificate: { status: 'completed', sha256_fingerprint: fingerprint } } })

test('observed redirect destinations connect distinct reports and retain evidence roles', () => {
  const a = fixture('1', 'https://one.example', 'Suspicious', [{ url: 'https://one.example/' }, { url: 'https://shared.example/pay' }])
  const b = fixture('2', 'https://two.example', 'Inconclusive', [{ url: 'https://two.example/' }, { url: 'https://shared.example/other' }])
  const original = JSON.stringify([a, b])
  const result = correlateReports([a, b])
  assert.equal(result.groups.length, 1)
  assert.equal(result.groups[0].label, 'Shared redirect destination')
  assert.equal(result.groups[0].distinctTargets, 2)
  assert.equal(result.reviewGroups, 1)
  assert.equal(result.linkedReports, 2)
  assert.deepEqual(result.groups[0].matches[0].roles, ['Observed redirect destination'])
  assert.equal(JSON.stringify([a, b]), original)
})

test('exact certificate matches can relate benign reports without propagating risk', () => {
  const a = fixture('1', 'https://one.example/', 'Confirmed Malicious', [hop('https://one.example/')])
  const b = fixture('2', 'https://two.example/', 'Low Risk', [hop('https://two.example/')])
  const result = correlateReports([a, b])
  assert.equal(result.groups[0].kind, 'certificate')
  assert.equal(result.groups[0].matches.find((m) => m.id === '2').classification, 'Low Risk')
  assert.equal(b.risk_classification, 'Low Risk')
  assert.equal(correlateReports([a, { ...b, redirect_chain: [hop('https://two.example/', false)] }]).groups.length, 0)
})

test('same-site rescans are repeated domains, with each report counted once', () => {
  const a = fixture('1', 'https://EXAMPLE.com./a', 'Low Risk', [{ url: 'https://example.com/b' }])
  const b = fixture('2', 'https://example.com/c')
  const result = correlateReports([a, a, b])
  assert.equal(result.reportsAnalysed, 2)
  assert.equal(result.groups.length, 1)
  assert.equal(result.groups[0].label, 'Repeated domain')
  assert.equal(result.groups[0].distinctTargets, 1)
  assert.equal(result.reviewGroups, 0)
  assert.equal(correlateReports([a, a]).groups.length, 0)
})

test('shared issuer names, parent domains, IPs and unobserved redirect parameters do not connect reports', () => {
  const a = fixture('1', 'https://one.example.com/?next=https://common.example')
  const b = fixture('2', 'https://two.example.com/?next=https://common.example')
  for (const report of [a, b]) {
    report.url_analysis = [{ hostname: 'common.example' }]
    report.redirect_chain = [{ url: report.normalized_url, address: '8.8.8.8', tls: { verified: true, issuer: { commonName: 'Shared CA' }, certificate: { status: 'completed', sha256_fingerprint: 'invalid' } } }]
  }
  assert.equal(correlateReports([a, b]).groups.length, 0)
  assert.equal(correlateReports([]).groups.length, 0)
})
