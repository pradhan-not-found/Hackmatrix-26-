import assert from 'node:assert/strict'
import { test } from 'node:test'
import { summarize } from '../src/lib/overview.mjs'

test('overview counts reflect backend classifications including unknown records', () => {
  const { distribution } = summarize([{ risk_classification: 'Low Risk' },
    { risk_classification: 'Confirmed Malicious' }, { risk_classification: 'legacy' }])
  assert.equal(distribution.reduce((sum, item) => sum + item.count, 0), 3)
  assert.equal(distribution.find((item) => item.key === 'low').count, 1)
  assert.equal(distribution.find((item) => item.key === 'unknown').count, 1)
})

test('activity uses local calendar days and excludes invalid and out-of-window dates', () => {
  const now = new Date(2026, 10, 7, 14)
  const scans = [new Date(2026, 10, 1, 0), new Date(2026, 10, 7, 23, 59),
    new Date(2026, 9, 31, 23, 59), new Date(2026, 10, 8, 0)]
    .map((created_at) => ({ created_at: created_at.toISOString() }))
  scans.push({ created_at: 'invalid' })
  const { days } = summarize(scans, now)
  assert.equal(days.length, 7)
  assert.equal(days[0].count, 1)
  assert.equal(days[6].count, 1)
  assert.equal(days.reduce((sum, day) => sum + day.count, 0), 2)
  assert.ok(summarize([], now).days.every((day) => day.count === 0))
})
