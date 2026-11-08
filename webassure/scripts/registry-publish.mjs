import { readFile, writeFile } from 'node:fs/promises'
import { JsonRpcProvider } from 'ethers'
import { checkedRegistry } from '../src/lib/registry.mjs'
import { registryNetwork } from '../src/lib/registry-networks.mjs'

// Read-only: publish a wallet-exported deployment after checking it on-chain.
const [file, rpc] = process.argv.slice(2)
if (!file) throw new Error('Usage: npm run ledger:publish -- path/to/deployment.json [sepolia-rpc-url]')
const config = JSON.parse(await readFile(file, 'utf8'))
if (String(config.chainId) !== '11155111') throw new Error('Only Sepolia deployment configurations can be published here.')
const network = registryNetwork(config.chainId)
const provider = new JsonRpcProvider(rpc || network.rpcUrl)
try {
  await checkedRegistry(provider, config)
  if (!/^0x[0-9a-f]{64}$/i.test(config.deploymentTransaction || '')) throw new Error('A deployment transaction hash is required.')
  const receipt = await provider.getTransactionReceipt(config.deploymentTransaction)
  if (!receipt || receipt.status !== 1 || receipt.contractAddress?.toLowerCase() !== config.address.toLowerCase()) throw new Error('The deployment receipt does not establish this contract address.')
  const trusted = { chainId: '11155111', address: receipt.contractAddress, deploymentTransaction: receipt.hash, deploymentBlock: receipt.blockNumber }
  await writeFile(new URL('../public/registry-sepolia.json', import.meta.url), JSON.stringify(trusted, null, 2) + '\n')
  console.log('Sepolia deployment verified and published for all dashboard users.')
} finally { provider.destroy() }
