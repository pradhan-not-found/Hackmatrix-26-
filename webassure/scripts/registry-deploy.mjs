import { writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { JsonRpcProvider, IpcSocketProvider, getAddress } from 'ethers'
import { deployRegistry } from '../src/lib/registry.mjs'

const { values } = parseArgs({ options: { sepolia: { type: 'boolean', default: false }, rpc: { type: 'string' },
  ipc: { type: 'string' }, from: { type: 'string' }, help: { type: 'boolean' } } })
if (values.help) {
  console.log('Local: npm run ledger:deploy\nSepolia via Geth/Clef: npm run ledger:deploy -- --sepolia --rpc http://127.0.0.1:8545 --from 0xPUBLIC_ADDRESS\nOr replace --rpc with --ipc PATH_TO_GETH_IPC. No private keys are accepted.')
  process.exit(0)
}
const chainId = values.sepolia ? '11155111' : '31337'
if (values.sepolia && !values.from) throw new Error('Sepolia requires --from with the public account address managed by your Geth/Clef signer.')
if (values.rpc && values.ipc) throw new Error('Choose either --rpc or --ipc.')
if (values.rpc) {
  const url = new URL(values.rpc)
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !['http:', 'https:'].includes(url.protocol)) throw new Error('Use a loopback Geth RPC endpoint or a local IPC connection for signing.')
}
const provider = values.ipc ? new IpcSocketProvider(values.ipc) : new JsonRpcProvider(values.rpc || 'http://127.0.0.1:8545')
const output = new URL(values.sepolia ? '../public/registry-sepolia.json' : '../public/ledger-config.json', import.meta.url)
try {
  if ((await provider.getNetwork()).chainId !== BigInt(chainId)) throw new Error(`Expected chain ${chainId}; check Geth's network before deploying.`)
  if (values.sepolia && await provider.send('eth_syncing', []) !== false) throw new Error('Wait for your Sepolia node to finish syncing before deployment.')
  const signer = await provider.getSigner(values.from ? getAddress(values.from) : 0)
  console.log(`Deploying to ${values.sepolia ? 'Ethereum Sepolia' : 'local demo'} from ${await signer.getAddress()}. Approve the contract-creation transaction in Clef if requested.`)
  const config = await deployRegistry(provider, signer, chainId, async (pending) => {
    // Keep recovery metadata even if confirmation times out after broadcasting.
    await writeFile(new URL(values.sepolia ? '../public/registry-sepolia.pending.json' : '../public/ledger-config.pending.json', import.meta.url), JSON.stringify(pending, null, 2) + '\n')
    console.log(`Deployment submitted: ${pending.deploymentTransaction}`)
  })
  await writeFile(output, JSON.stringify(config, null, 2) + '\n')
  console.log(JSON.stringify(config, null, 2))
  console.log('Registry bytecode verified; dashboard configuration saved.')
} finally { provider.destroy() }
