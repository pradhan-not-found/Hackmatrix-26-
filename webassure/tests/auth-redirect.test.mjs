import test from 'node:test'
import assert from 'node:assert/strict'
import { dashboardPath } from '../src/lib/auth-redirect.mjs'

test('auth preserves intended dashboard routes and query parameters', () => {
  for (const path of ['/dashboard', '/dashboard/scans', '/dashboard/scans?report=123#details']) {
    assert.equal(dashboardPath(path), path)
  }
})

test('auth rejects external destinations and dashboard prefix lookalikes', () => {
  for (const path of [null, '', 'https://evil.example', '//evil.example', '/dashboard-evil', '/dashboard\\evil.example', '/login']) {
    assert.equal(dashboardPath(path), '/dashboard')
  }
})
