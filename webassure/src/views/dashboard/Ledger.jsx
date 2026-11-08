'use client'

import { useEffect, useState } from 'react'
import { BrowserProvider, JsonRpcProvider, formatEther, getAddress } from 'ethers'
import { useDash } from './context.js'
import { PageHead } from './ui.jsx'
import { downloadReport } from '../../lib/investigations.js'
import { checkedRegistry, createSnapshot, snapshotDigest, verifyBundle, deployRegistry } from '../../lib/registry.mjs'
import { registryNetwork, REGISTRY_NETWORKS, authorizeRegistryWallet, explorerLink } from '../../lib/registry-networks.mjs'

const AlertIcon = () => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5h.01" /></svg>
const WalletIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 7V5.5A1.5 1.5 0 0 0 17.5 4H5.5a2 2 0 0 0 0 4H19a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2H6a3 3 0 0 1-3-3V6" /><path d="M16.5 14h.01" /></svg>
const UploadIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V5M7.5 9.5 12 5l4.5 4.5M5 19h14" /></svg>

function downloadConfig(config) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url; link.download = `registry-${config.chainId}.json`
  document.body.append(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function ChainLink({ config, type, value, children, className = '' }) {
  let href = null
  try { href = explorerLink(config, type, value) } catch {}
  return href ? <a className={`ledger-explorer ${className}`} href={href} target="_blank" rel="noopener noreferrer">{children}</a> : children
}

export default function Ledger() {
  const { scans, getReport, historyLoading, historyError, total, loadMore } = useDash()
  const [config, setConfig] = useState(null)
  const [chainId, setChainId] = useState('11155111')
  const [configLoading, setConfigLoading] = useState(true)
  const [account, setAccount] = useState('')
  const [walletChain, setWalletChain] = useState('')
  const [balance, setBalance] = useState('')
  const [existingAddress, setExistingAddress] = useState('')
  const [selected, setSelected] = useState('')
  const [bundle, setBundle] = useState(null)
  const [verified, setVerified] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [setupError, setSetupError] = useState('')
  const [notice, setNotice] = useState('')
  const network = registryNetwork(chainId)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('wa-ledger-network')
      if (saved && REGISTRY_NETWORKS[saved]) setChainId(saved)
    } catch {}
  }, [])
  useEffect(() => {
    let active = true
    setConfig(null); setSetupError(''); setConfigLoading(true); setVerified(null); setBundle(null); setNotice(''); setError('')
    const load = async () => {
      let saved = null
      try { saved = JSON.parse(localStorage.getItem(`wa-registry:${chainId}`) || 'null') } catch {}
      try {
        const response = await fetch(registryNetwork(chainId).configPath, { cache: 'no-store' })
        if (response.ok) saved = await response.json()
        else if (response.status !== 404) throw new Error('Could not load the published registry configuration. You can retry or use an existing address.')
        if (saved && (String(saved.chainId) !== chainId || !getAddress(saved.address))) throw new Error('The saved registry configuration does not match the selected network.')
        if (active) setConfig(saved)
      } catch (failure) {
        if (active) { setSetupError(failure.message); setConfig(null) }
      } finally { if (active) setConfigLoading(false) }
    }
    load()
    return () => { active = false }
  }, [chainId])
  useEffect(() => {
    const ethereum = window.ethereum
    if (!ethereum?.on) return
    const accountsChanged = (accounts) => { setAccount(accounts[0] || ''); setBalance(''); setVerified(null) }
    const chainChanged = (value) => { setWalletChain(BigInt(value).toString()); setBalance(''); setVerified(null) }
    ethereum.on('accountsChanged', accountsChanged); ethereum.on('chainChanged', chainChanged)
    return () => { ethereum.removeListener?.('accountsChanged', accountsChanged); ethereum.removeListener?.('chainChanged', chainChanged) }
  }, [])
  const saveConfig = (value) => {
    setConfig(value); setSetupError('')
    try { localStorage.setItem(`wa-registry:${chainId}`, JSON.stringify(value)) } catch {}
  }
  const wallet = async () => {
    if (!window.ethereum) throw new Error('Connect an Ethereum browser wallet to use the registry.')
    await authorizeRegistryWallet(window.ethereum, chainId)
    const provider = new BrowserProvider(window.ethereum)
    const signer = await provider.getSigner()
    const address = await signer.getAddress()
    setAccount(address); setWalletChain(chainId)
    setBalance(formatEther(await provider.getBalance(address)))
    return { provider, signer }
  }
  const read = async (action) => {
    // Sepolia verification uses public read-only RPC, even without a wallet.
    const provider = chainId === '31337' && window.ethereum
      ? new BrowserProvider(window.ethereum) : new JsonRpcProvider(network.rpcUrl)
    try { return await action(provider) } finally { provider.destroy() }
  }
  const perform = async (name, action) => {
    setBusy(name); setError(''); setNotice(''); setVerified(null)
    try { await action() }
    catch (e) { setError(e.code === 'ACTION_REJECTED' || e.code === 4001 ? 'Request declined in your wallet. You can try again when ready.' : e.shortMessage || e.message || 'Registry operation failed. Please retry.') }
    finally { setBusy('') }
  }
  const connect = () => perform('Connecting wallet', async () => { await wallet(); setNotice(`Wallet connected to ${network.name}.`) })
  const deploy = () => perform('Waiting for deployment approval and confirmation', async () => {
    const { provider, signer } = await wallet()
    const deployed = await deployRegistry(provider, signer, chainId, (pending) => {
      saveConfig({ ...pending, pending: true })
      setNotice(`Deployment submitted: ${pending.deploymentTransaction}. Keep this page open or use Check deployment after confirmation.`)
    })
    saveConfig(deployed)
    setNotice('Registry deployed and bytecode verified. Download the deployment configuration, then prepare a report snapshot.')
  })
  const checkDeployment = () => perform('Checking deployment', () => read(async (provider) => {
    await checkedRegistry(provider, config)
    const receipt = await provider.getTransactionReceipt(config.deploymentTransaction)
    if (!receipt || receipt.status !== 1 || receipt.contractAddress?.toLowerCase() !== config.address.toLowerCase()) throw new Error('Deployment has not confirmed successfully yet. Do not deploy again while this transaction is pending.')
    saveConfig({ chainId, address: config.address, deploymentTransaction: receipt.hash, deploymentBlock: receipt.blockNumber })
    setNotice('Deployment confirmed and registry bytecode verified.')
  }))
  const useExisting = () => perform('Checking registry address', () => read(async (provider) => {
    const next = { chainId, address: getAddress(existingAddress.trim()) }
    await checkedRegistry(provider, next)
    saveConfig(next); setExistingAddress('')
    setNotice('Existing registry bytecode verified and selected.')
  }))
  const prepare = () => perform('Preparing', async () => {
    const snapshot = createSnapshot(await getReport(selected))
    setBundle({ snapshot, registration: null })
    setNotice('Snapshot prepared. Export a backup before registering; this file is required for verification.')
  })
  const register = () => perform('Waiting for wallet and confirmation', async () => {
    const { provider, signer } = await wallet()
    const contract = await checkedRegistry(provider, config, signer)
    const digest = snapshotDigest(bundle.snapshot)
    const tx = await contract.register(digest)
    const next = { ...bundle, registration: { chainId: String(config.chainId), address: config.address, digest, transactionHash: tx.hash } }
    setBundle(next)
    setNotice(`Transaction submitted: ${tx.hash}. Export the receipt to keep a recovery copy.`)
    await tx.wait(1, 120000)
    setVerified(await verifyBundle(provider, config, next))
    setNotice('Registration confirmed. Export the receipt to preserve your report and verification proof.')
  })
  const verify = () => perform('Verifying', async () => {
    setVerified(await read((provider) => verifyBundle(provider, config, bundle)))
    setNotice('Integrity verified against the registration transaction. This does not establish that the report is true.')
  })
  const upload = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    perform('Reading file', async () => {
      setBundle(null)
      if (file.size > 5 * 1024 * 1024) throw new Error('Choose a receipt smaller than 5 MiB.')
      const imported = JSON.parse(await file.text())
      snapshotDigest(imported.snapshot)
      setBundle(imported)
      setNotice('Receipt loaded. Verify it against the configured registry.')
    })
  }
  return <>
    <PageHead title="Threat ledger" sub="Register report fingerprints and independently verify report integrity." />

    <div className="ledger-panel ledger-stack">

      {/* Section 1: On-chain Registry & Network */}
      <section className="card panel ledger-card">
        <div className="ledger-head">
          <div>
            <p className="ledger-step"><span>1</span>Registry<em>Choose a network and connect the on-chain registry</em></p>
            <p className="caption grey">Only a salted fingerprint is recorded on-chain. Report contents remain in your exported file. Registration proves integrity and provenance, not whether a website is malicious.</p>
          </div>
          <span className={`ledger-status${config && !config.pending ? ' ledger-status--on' : ''}`}>
            <i />{configLoading ? 'Loading registry' : config?.pending ? 'Deployment pending' : config ? 'Registry configured' : 'Ready to deploy'}
          </span>
        </div>

        <div className="ledger-network-row">
          <label className="ledger-field">Network
            <span className="ledger-select"><select className="input-sm" aria-label="Registry network" value={chainId} disabled={!!busy} onChange={(event) => { setChainId(event.target.value); try { localStorage.setItem('wa-ledger-network', event.target.value) } catch {} }}>
              {Object.values(REGISTRY_NETWORKS).map((item) => <option key={item.chainId} value={item.chainId}>{item.name}</option>)}
            </select></span>
          </label>
          <div className="ledger-wallet">
            <p className="caption grey">
              {account ? <><code title={account}>{account.slice(0, 8)}…{account.slice(-6)}</code>{balance && ` · ${Number(balance).toPrecision(4)} test ETH`}{walletChain !== chainId && ' · Switch network to continue'}</> : 'Connect MetaMask to deploy or register. Verification needs no wallet.'}
            </p>
            <button className="btn btn--ghost" disabled={!!busy} onClick={connect}>
              <WalletIcon />
              {account && walletChain === chainId ? 'Refresh wallet' : 'Connect wallet'}
            </button>
          </div>
        </div>

        {config && (
          <div className="ledger-address-bar">
            <span className="caption grey">Chain {config.chainId} · Registry</span>
            <ChainLink config={config} type="address" value={config.address}><code>{config.address}</code></ChainLink>
          </div>
        )}

        {config?.deploymentTransaction && (
          <div className="ledger-actions">
            <ChainLink config={config} type="tx" value={config.deploymentTransaction}>
              <span className="btn btn--ghost">View deployment transaction</span>
            </ChainLink>
            <button className="btn btn--ghost" onClick={() => downloadConfig(config)}>Download deployment config</button>
            {config.pending && <button className="btn btn--ink" disabled={!!busy} onClick={checkDeployment}>Check deployment</button>}
          </div>
        )}

        {!config && !configLoading && (
          <div className="ledger-onboarding">
            <h3>Deploy your report registry</h3>
            <p className="caption grey">One-time setup on {network.name}. MetaMask will ask you to approve a contract deployment using test ETH. Your private key stays in your wallet.</p>
            <div className="ledger-actions">
              <button className="btn btn--ink" disabled={!!busy} onClick={deploy}>Deploy registry</button>
              {chainId === '11155111' && <a className="ledger-explorer" href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia" target="_blank" rel="noopener noreferrer">Get free Sepolia ETH</a>}
              <a className="ledger-explorer" href="https://metamask.com/download" target="_blank" rel="noopener noreferrer">Install MetaMask</a>
            </div>
          </div>
        )}

        {!configLoading && (
          <details className="ledger-existing">
            <summary>Use an already deployed registry</summary>
            <div className="ledger-actions">
              <input className="input-sm" aria-label="Existing registry address" placeholder="Registry contract address (0x…)" value={existingAddress} disabled={!!busy} onChange={(event) => setExistingAddress(event.target.value)} />
              <button className="btn btn--ghost" disabled={!!busy || !existingAddress.trim()} onClick={useExisting}>Use registry</button>
            </div>
            <p className="caption grey">The deployed contract must match WebAssure’s registry bytecode.</p>
          </details>
        )}

        {setupError && (
          <div className="ledger-alert" role="status">
            <AlertIcon />
            <div>
              <strong>Registry not connected</strong>
              <p className="caption grey">{setupError}</p>
            </div>
          </div>
        )}
      </section>

      {/* Section 2: Report Fingerprint, Commitment & Verification */}
      <section className="card panel ledger-card">
        <div className="ledger-head">
          <div>
            <p className="ledger-step"><span>2</span>Report commitment &amp; verification<em>Fingerprint a saved investigation or import a receipt</em></p>
            <p className="caption grey">Commit report fingerprints on-chain with your wallet, or independently verify a receipt JSON file against the registry.</p>
          </div>
          <label className="btn btn--ghost ledger-import">
            <UploadIcon />
            <span>Import receipt</span>
            <input className="ledger-upload" type="file" accept=".json,application/json" disabled={!!busy} onChange={upload} />
          </label>
        </div>

        <label className="ledger-field">Saved investigation
          <span className="ledger-select">
            <select className="input-sm" value={selected} disabled={!!busy} onChange={(e) => { setSelected(e.target.value); setBundle(null); setVerified(null); setNotice('') }}>
              <option value="">Choose a report</option>
              {scans.map((scan) => <option key={scan.id} value={scan.id}>{scan.normalized_url} — {scan.risk_classification}</option>)}
            </select>
          </span>
        </label>

        {!scans.length && !historyError && (
          <p className="caption grey">{historyLoading ? 'Loading saved reports…' : 'Run a URL investigation to prepare your first report.'}</p>
        )}

        {historyError && (
          <div className="ledger-alert" role="alert">
            <AlertIcon />
            <div>
              <strong>Saved reports unavailable</strong>
              <p className="caption grey">{historyError}</p>
            </div>
          </div>
        )}

        <div className="ledger-actions">
          <button className="btn btn--ink" disabled={!selected || !!busy} onClick={prepare}>Prepare snapshot</button>
          {scans.length < total && (
            <button className="btn btn--ghost" disabled={historyLoading || !!busy} onClick={loadMore}>Load more reports</button>
          )}
        </div>

        {bundle && (
          <div className="ledger-snapshot">
            <div>
              <p className="caption grey">Snapshot fingerprint</p>
              <code>{snapshotDigest(bundle.snapshot)}</code>
            </div>
            <div className="ledger-actions">
              <button className="btn btn--ghost" onClick={() => downloadReport(bundle)}>
                Export {bundle.registration ? 'receipt' : 'snapshot'}
              </button>
              <button className="btn btn--ink" disabled={!config || config.pending || !!busy || !!bundle.registration} onClick={register}>
                Register with wallet
              </button>
              <button className="btn btn--ghost" disabled={!config || config.pending || !!busy || !bundle.registration} onClick={verify}>
                Verify integrity
              </button>
            </div>
            {bundle.registration && (
              <div className="ledger-address-bar">
                <span className="caption grey">Transaction</span>
                <ChainLink config={bundle.registration} type="tx" value={bundle.registration.transactionHash}><code>{bundle.registration.transactionHash}</code></ChainLink>
              </div>
            )}
          </div>
        )}

        {busy && <p className="ledger-message" role="status">{busy}…</p>}
        {error && <p className="ledger-message ledger-message--bad" role="alert">{error}</p>}
        {notice && <p className="ledger-message" role="status">{notice}</p>}
        {verified && (
          <div className="ledger-verified">
            <strong>Integrity verified</strong>
            <p className="caption grey ledger-address">Registered by {verified.reporter} · Block {verified.blockNumber}</p>
          </div>
        )}
      </section>

    </div>
  </>
}
