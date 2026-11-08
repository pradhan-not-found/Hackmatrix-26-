import { Contract, ContractFactory, Interface, keccak256, toUtf8Bytes, getAddress } from 'ethers'
import { REGISTRY_ARTIFACT } from './registry-artifact.mjs'
import { registryNetwork } from './registry-networks.mjs'

export const REGISTRY_ABI = [
  'function register(bytes32 digest)',
  'function registeredAt(address reporter, bytes32 digest) view returns (uint256)',
  'event ReportRegistered(address indexed reporter, bytes32 indexed digest, uint256 timestamp)',
]
export const SCHEMA = 'webassure-report-commitment/v1'

// v1: JSON values, recursively sorted object keys (UTF-16 order), array order
// preserved, JSON.stringify primitive encoding. No fields are omitted.
export function canonicalize(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`
  throw new Error('Snapshot contains a value unsupported by commitment format v1.')
}

export function snapshotDigest(snapshot) {
  if (snapshot?.schema !== SCHEMA || !/^[0-9a-f]{64}$/.test(snapshot.nonce || '') || !snapshot.report || typeof snapshot.report !== 'object' || Array.isArray(snapshot.report)) {
    throw new Error('Invalid report snapshot or unsupported commitment format.')
  }
  return keccak256(toUtf8Bytes(canonicalize(snapshot)))
}

export function createSnapshot(report) {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(32))
  return { schema: SCHEMA, nonce: Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(''), report: JSON.parse(JSON.stringify(report)) }
}

export async function checkedRegistry(provider, config, signer = provider) {
  registryNetwork(config.chainId)
  const network = await provider.getNetwork()
  if (network.chainId.toString() !== String(config.chainId)) throw new Error(`Switch your wallet to chain ${config.chainId}.`)
  const address = getAddress(config.address)
  const code = await provider.getCode(address)
  if (code === '0x') throw new Error('Registry contract is not deployed on this network. A pending deployment may need more time.')
  if (keccak256(code) !== keccak256(REGISTRY_ARTIFACT.deployedBytecode)) throw new Error('Contract bytecode does not match the WebAssure registry. Check the deployment address.')
  return new Contract(address, REGISTRY_ABI, signer)
}

export async function deployRegistry(provider, signer, chainId, onSubmitted = () => {}) {
  registryNetwork(chainId)
  if ((await provider.getNetwork()).chainId !== BigInt(chainId)) throw new Error('The signer is connected to a different network.')
  const account = await signer.getAddress()
  if (await provider.getBalance(account) === 0n) throw new Error('This account needs test ETH to pay deployment gas. Fund it on the selected test network first.')
  const factory = new ContractFactory(REGISTRY_ARTIFACT.abi, REGISTRY_ARTIFACT.bytecode, signer)
  const request = await factory.getDeployTransaction()
  const gas = await signer.estimateGas(request)
  const fees = await provider.getFeeData()
  const price = fees.maxFeePerGas ?? fees.gasPrice
  if (price && await provider.getBalance(account) < gas * price) throw new Error('Insufficient test ETH for the estimated deployment fee.')
  const contract = await factory.deploy()
  const tx = contract.deploymentTransaction()
  const config = { chainId: String(chainId), address: await contract.getAddress(), deploymentTransaction: tx.hash }
  await onSubmitted(config)
  const receipt = await tx.wait(1, 120000)
  if (!receipt || receipt.status !== 1) throw new Error('Registry deployment failed or is still pending.')
  const completed = { ...config, deploymentBlock: receipt.blockNumber }
  await checkedRegistry(provider, completed)
  return completed
}

export async function verifyBundle(provider, config, bundle) {
  const digest = snapshotDigest(bundle.snapshot)
  const r = bundle.registration
  if (!r || r.digest !== digest) throw new Error('Integrity mismatch: the report or fingerprint has changed.')
  return verifyRegistration(provider, config, r)
}

export async function verifyRegistration(provider, config, r) {
  if (!/^0x[0-9a-f]{64}$/i.test(r?.digest || '') || !/^0x[0-9a-f]{64}$/i.test(r?.transactionHash || '')) throw new Error('Invalid registration fingerprint or transaction hash.')
  const digest = r.digest
  if (String(r.chainId) !== String(config.chainId) || getAddress(r.address) !== getAddress(config.address)) throw new Error('Receipt belongs to a different registry or network.')
  const contract = await checkedRegistry(provider, config)
  const receipt = await provider.getTransactionReceipt(r.transactionHash)
  if (!receipt || receipt.status !== 1) throw new Error('Registration transaction is missing, pending, or failed.')
  if (receipt.to?.toLowerCase() !== config.address.toLowerCase()) throw new Error('Transaction did not call this registry.')
  const iface = new Interface(REGISTRY_ABI)
  const match = receipt.logs.filter((log) => log.address.toLowerCase() === config.address.toLowerCase()).some((log) => {
    try { const event = iface.parseLog(log); return event?.name === 'ReportRegistered' && event.args.digest === digest && event.args.reporter.toLowerCase() === receipt.from.toLowerCase() } catch { return false }
  })
  if (!match || await contract.registeredAt(receipt.from, digest) === 0n) throw new Error('Matching on-chain registration was not found.')
  return { digest, reporter: receipt.from, blockNumber: receipt.blockNumber, transactionHash: receipt.hash }
}
