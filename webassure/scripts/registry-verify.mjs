import { readFile } from 'node:fs/promises'
import { JsonRpcProvider } from 'ethers'
import { verifyBundle } from '../src/lib/registry.mjs'
import { registryNetwork } from '../src/lib/registry-networks.mjs'

const [file, rpc, configFile] = process.argv.slice(2)
if (!file) throw new Error('Usage: npm run ledger:verify -- path/to/receipt.json [rpc-url]')
let provider
try {
  const bundle = JSON.parse(await readFile(file, 'utf8'))
  const network = registryNetwork(bundle.registration?.chainId)
  const config = JSON.parse(await readFile(configFile || new URL(`../public/${network.chainId === '11155111' ? 'registry-sepolia.json' : 'ledger-config.json'}`, import.meta.url), 'utf8'))
  provider = new JsonRpcProvider(rpc || network.rpcUrl)
  console.log(JSON.stringify(await verifyBundle(provider, config, bundle), null, 2))
  console.log('Integrity verified. This does not establish the truth of the report.')
} catch (error) { console.error(error.shortMessage || error.message); process.exitCode = 1 }
finally { provider?.destroy() }
