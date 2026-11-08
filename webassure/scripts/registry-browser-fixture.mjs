// Ephemeral real EVM for browser regression; no persistent data or real funds.
import ganache from 'ganache'
import { ContractFactory, JsonRpcProvider } from 'ethers'
import { compileRegistry } from './registry-compile.mjs'

const chainId = process.argv.includes('--sepolia') ? 11155111 : 31337
const server = ganache.server({ chain: { chainId, hardfork: 'shanghai' }, logging: { quiet: true } })
await server.listen(0, '127.0.0.1')
const rpc = `http://127.0.0.1:${server.address().port}`
const provider = new JsonRpcProvider(rpc)
let address = null
if (!process.argv.includes('--undeployed')) {
  const { abi, bytecode } = await compileRegistry()
  const registry = await new ContractFactory(abi, bytecode, await provider.getSigner()).deploy()
  await registry.waitForDeployment()
  address = await registry.getAddress()
}
console.log(JSON.stringify({ rpc, chainId: String(chainId), address }))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {
  provider.destroy(); await server.close(); process.exit(0)
})
