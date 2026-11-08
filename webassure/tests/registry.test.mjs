import test from 'node:test'
import assert from 'node:assert/strict'
import ganache from 'ganache'
import { BrowserProvider, ContractFactory, ZeroHash } from 'ethers'
import { compileRegistry } from '../scripts/registry-compile.mjs'
import { canonicalize, createSnapshot, snapshotDigest, verifyBundle } from '../src/lib/registry.mjs'

test('versioned canonical snapshots preserve all evidence and ignore object key order', () => {
  const a = createSnapshot({ id: 'fixture', findings: [{ a: 1, b: 'é' }] })
  const b = { report: { findings: [{ b: 'é', a: 1 }], id: 'fixture' }, nonce: a.nonce, schema: a.schema }
  assert.equal(snapshotDigest(a), snapshotDigest(b))
  assert.notEqual(snapshotDigest(a), snapshotDigest(createSnapshot(a.report)))
  b.report.findings[0].a = 2
  assert.notEqual(snapshotDigest(a), snapshotDigest(b))
  assert.throws(() => snapshotDigest({ ...a, schema: 'unknown' }))
  assert.throws(() => canonicalize({ confidence: Infinity }))
})

test('real EVM registration, independent verification, tampering and provenance checks', async () => {
  const chain = ganache.provider({ logging: { quiet: true }, chain: { chainId: 31337, hardfork: 'shanghai' } })
  const provider = new BrowserProvider(chain)
  try {
    const signer = await provider.getSigner()
    const { abi, bytecode } = await compileRegistry()
    const registry = await new ContractFactory(abi, bytecode, signer).deploy()
    await registry.waitForDeployment()
    const config = { chainId: '31337', address: await registry.getAddress() }
    const snapshot = createSnapshot({ id: 'fixture', risk_classification: 'Inconclusive', findings: [] })
    const digest = snapshotDigest(snapshot)
    const tx = await registry.register(digest)
    await tx.wait()
    const bundle = { snapshot, registration: { ...config, digest, transactionHash: tx.hash } }
    const verified = await verifyBundle(provider, config, JSON.parse(JSON.stringify(bundle)))
    assert.equal(verified.digest, digest)
    assert.equal(verified.reporter, await signer.getAddress())
    const changed = structuredClone(bundle)
    changed.snapshot.report.risk_classification = 'Low Risk'
    await assert.rejects(verifyBundle(provider, config, changed), /mismatch/)
    changed.registration.digest = snapshotDigest(changed.snapshot)
    await assert.rejects(verifyBundle(provider, config, changed), /not found/)
    await assert.rejects(verifyBundle(provider, { ...config, chainId: '1' }, bundle), /different/)
    await assert.rejects(verifyBundle(provider, config, { ...bundle, registration: { ...bundle.registration, transactionHash: registry.deploymentTransaction().hash } }), /did not call/)
    await assert.rejects(async () => { await (await registry.register(digest, { gasLimit: 100000 })).wait() })
    await assert.rejects(async () => { await (await registry.register(ZeroHash, { gasLimit: 100000 })).wait() })
    const second = registry.connect(await provider.getSigner(1))
    await (await second.register(digest)).wait()
    assert.notEqual(await second.registeredAt(await second.runner.getAddress(), digest), 0n)
  } finally { provider.destroy(); await chain.disconnect() }
})
