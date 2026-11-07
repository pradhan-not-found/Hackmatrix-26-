import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } from 'next/constants.js'
import config from '../next.config.mjs'

test('development and production builds use separate output directories', () => {
  const previous = process.env.NEXT_DIST_DIR
  delete process.env.NEXT_DIST_DIR
  try {
    assert.equal(config(PHASE_DEVELOPMENT_SERVER).distDir, '.next-dev')
    assert.equal(config(PHASE_PRODUCTION_BUILD).distDir, '.next')
    assert.equal(config(PHASE_PRODUCTION_SERVER).distDir, '.next')
    process.env.NEXT_DIST_DIR = '.next-test'
    assert.equal(config(PHASE_DEVELOPMENT_SERVER).distDir, '.next-test')
    assert.equal(config(PHASE_PRODUCTION_BUILD).distDir, '.next-test')
  } finally {
    if (previous === undefined) delete process.env.NEXT_DIST_DIR
    else process.env.NEXT_DIST_DIR = previous
  }
})
