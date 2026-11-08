import ganache from 'ganache'
import { mkdir } from 'node:fs/promises'

const directory = new URL('../../data/ledger-chain/', import.meta.url)
await mkdir(directory, { recursive: true })
const { fileURLToPath } = await import('node:url')
const server = ganache.server({
  chain: { chainId: 31337, hardfork: 'shanghai' },
  database: { dbPath: fileURLToPath(directory) },
  wallet: { deterministic: true },
  logging: { quiet: true },
})
await server.listen(8545, '127.0.0.1')
console.log('Local demo chain: http://127.0.0.1:8545 (chain 31337).')
console.log('Demo accounts only. Use Ganache deterministic accounts in your wallet; never fund them on public networks.')
for (const [address, account] of Object.entries(server.provider.getInitialAccounts()).slice(0, 1)) {
  console.log(`Local-only account: ${address}\nLocal-only private key: ${account.secretKey}`)
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await server.close(); process.exit(0) })
