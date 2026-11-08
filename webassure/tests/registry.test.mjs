import test from 'node:test'
import assert from 'node:assert/strict'
import ganache from 'ganache'
import { BrowserProvider, ContractFactory, ZeroHash } from 'ethers'
import { compileRegistry } from '../scripts/registry-compile.mjs'
import { canonicalize, createSnapshot, snapshotDigest, verifyBundle, deployRegistry, checkedRegistry } from '../src/lib/registry.mjs'
import { registryNetwork, switchRegistryNetwork, authorizeRegistryWallet, explorerLink } from '../src/lib/registry-networks.mjs'
import { REGISTRY_ARTIFACT } from '../src/lib/registry-artifact.mjs'

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

test('Sepolia deployment flow uses compiled bytecode, keeps recovery metadata and rejects unfunded accounts', async () => {
  const chain = ganache.provider({ logging: { quiet: true }, chain: { chainId: 11155111, hardfork: 'shanghai' } })
  const provider = new BrowserProvider(chain)
  try {
    const compiled = await compileRegistry()
    assert.equal(compiled.bytecode, REGISTRY_ARTIFACT.bytecode)
    assert.equal(compiled.deployedBytecode, REGISTRY_ARTIFACT.deployedBytecode)
    let pending
    const config = await deployRegistry(provider, await provider.getSigner(), '11155111', (value) => { pending = value })
    assert.equal(config.chainId, '11155111')
    assert.equal(pending.deploymentTransaction, config.deploymentTransaction)
    assert.ok(config.deploymentBlock > 0)
    await checkedRegistry(provider, config)
    await assert.rejects(deployRegistry(provider, { getAddress: async () => '0x000000000000000000000000000000000000dEaD' }, '11155111'), /needs test ETH/)
    await assert.rejects(checkedRegistry({ getNetwork: async () => ({ chainId: 11155111n }), getCode: async () => '0x6000' }, config), /bytecode does not match/)
    assert.equal(explorerLink(config, 'tx', config.deploymentTransaction), `https://sepolia.etherscan.io/tx/${config.deploymentTransaction}`)
    assert.throws(() => registryNetwork('1'), /Mainnet deployment is disabled/)
  } finally { provider.destroy(); await chain.disconnect() }
})

test('wallet network setup adds Sepolia only when missing and preserves user rejection', async () => {
  const calls = []
  let attempts = 0
  const ethereum = { request: async (request) => {
    calls.push(request)
    if (request.method === 'eth_chainId') return '0x1'
    if (request.method === 'wallet_switchEthereumChain' && ++attempts === 1) throw Object.assign(new Error('Missing chain'), { code: 4902 })
    return null
  } }
  await switchRegistryNetwork(ethereum, '11155111')
  assert.deepEqual(calls.map((call) => call.method), ['eth_chainId', 'wallet_switchEthereumChain', 'wallet_addEthereumChain', 'wallet_switchEthereumChain'])
  assert.equal(calls[2].params[0].chainId, '0xaa36a7')
  await assert.rejects(switchRegistryNetwork({ request: async ({ method }) => {
    if (method === 'eth_chainId') return '0x1'
    throw Object.assign(new Error('Declined'), { code: 4001 })
  } }, '11155111'), /Declined/)
})

test('wallet authorization happens before network approval and rejection stops the flow', async () => {
  const calls = []
  await authorizeRegistryWallet({ request: async ({ method }) => {
    calls.push(method)
    if (method === 'eth_requestAccounts') return ['0x0000000000000000000000000000000000000001']
    if (method === 'eth_chainId') return '0x1'
    return null
  } }, '11155111')
  assert.deepEqual(calls, ['eth_requestAccounts', 'eth_chainId', 'wallet_switchEthereumChain'])
  const rejected = []
  await assert.rejects(authorizeRegistryWallet({ request: async ({ method }) => {
    rejected.push(method)
    throw Object.assign(new Error('Declined'), { code: 4001 })
  } }, '11155111'), /Declined/)
  assert.deepEqual(rejected, ['eth_requestAccounts'])
})
