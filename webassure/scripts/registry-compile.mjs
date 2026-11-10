import { readFile } from 'node:fs/promises'
import solc from 'solc'

export async function compileRegistry() {
  // The deployed registry was compiled from CRLF source, and line endings are part of the
  // metadata hash. Normalising them lets every platform reproduce the deployed bytecode.
  const source = await readFile(new URL('../contracts/ThreatRegistry.sol', import.meta.url), 'utf8')
  const content = source.replace(/\r?\n/g, '\r\n')
  const output = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources: { 'ThreatRegistry.sol': { content } }, settings: { evmVersion: 'shanghai', optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } } } })))
  const errors = (output.errors || []).filter((e) => e.severity === 'error')
  if (errors.length) throw new Error(errors.map((e) => e.formattedMessage).join('\n'))
  const contract = output.contracts['ThreatRegistry.sol'].ThreatRegistry
  return { abi: contract.abi, bytecode: `0x${contract.evm.bytecode.object}`, deployedBytecode: `0x${contract.evm.deployedBytecode.object}` }
}
