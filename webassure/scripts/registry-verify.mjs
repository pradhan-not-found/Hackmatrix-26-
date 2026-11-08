import { readFile } from 'node:fs/promises'
import { JsonRpcProvider } from 'ethers'
import { verifyBundle } from '../src/lib/registry.mjs'

const [file, rpc = 'http://127.0.0.1:8545'] = process.argv.slice(2)
if (!file) throw new Error('Usage: npm run ledger:verify -- path/to/receipt.json [rpc-url]')
const provider = new JsonRpcProvider(rpc)
try {
  const bundle = JSON.parse(await readFile(file, 'utf8'))
  const config = JSON.parse(await readFile(new URL('../public/ledger-config.json', import.meta.url), 'utf8'))
  console.log(JSON.stringify(await verifyBundle(provider, config, bundle), null, 2))
  console.log('Integrity verified. This does not establish the truth of the report.')
} catch (error) { console.error(error.shortMessage || error.message); process.exitCode = 1 }
finally { provider.destroy() }
