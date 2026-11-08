import { writeFile } from 'node:fs/promises'
import { ContractFactory, JsonRpcProvider } from 'ethers'
import { compileRegistry } from './registry-compile.mjs'

const provider = new JsonRpcProvider('http://127.0.0.1:8545')
try {
  const { chainId } = await provider.getNetwork()
  if (chainId !== 31337n) throw new Error('Deployment script is restricted to the local demo chain 31337.')
  const { abi, bytecode } = await compileRegistry()
  const contract = await new ContractFactory(abi, bytecode, await provider.getSigner(0)).deploy()
  await contract.waitForDeployment()
  const receipt = await contract.deploymentTransaction().wait()
  const config = { chainId: String(chainId), address: await contract.getAddress(), deploymentBlock: receipt.blockNumber, deploymentTransaction: receipt.hash }
  await writeFile(new URL('../public/ledger-config.json', import.meta.url), JSON.stringify(config, null, 2) + '\n')
  console.log(JSON.stringify(config, null, 2))
} finally { provider.destroy() }
