import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { JsonRpcProvider } from 'ethers'
import { checkedRegistry, createSnapshot, snapshotDigest, verifyBundle } from '../src/lib/registry.mjs'

const provider = new JsonRpcProvider('http://127.0.0.1:8545')
try {
  const config = JSON.parse(await readFile(new URL('../public/ledger-config.json', import.meta.url), 'utf8'))
  const registry = await checkedRegistry(provider, config, await provider.getSigner(0))
  const snapshot = createSnapshot({ id: 'local-integrity-demo', created_at: new Date().toISOString(), risk_classification: 'Inconclusive', findings: [], limitations: ['Synthetic integrity fixture; no URL was scanned.'] })
  const digest = snapshotDigest(snapshot)
  const tx = await registry.register(digest)
  await tx.wait()
  const bundle = { snapshot, registration: { chainId: config.chainId, address: config.address, digest, transactionHash: tx.hash } }
  await mkdir(new URL('../../data/', import.meta.url), { recursive: true })
  await writeFile(new URL('../../data/ledger-demo-receipt.json', import.meta.url), JSON.stringify(bundle, null, 2) + '\n')
  console.log(JSON.stringify(await verifyBundle(provider, config, bundle), null, 2))
  console.log('Saved ../data/ledger-demo-receipt.json. Verify independently with ledger:verify.')
} finally { provider.destroy() }
