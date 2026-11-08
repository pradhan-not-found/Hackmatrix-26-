'use client'

import { useEffect, useState } from 'react'
import { BrowserProvider } from 'ethers'
import { useDash } from './context.js'
import { PageHead } from './ui.jsx'
import { downloadReport } from '../../lib/investigations.js'
import { checkedRegistry, createSnapshot, snapshotDigest, verifyBundle } from '../../lib/registry.mjs'

const AlertIcon = () => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5h.01" /></svg>
const UploadIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V5M7.5 9.5 12 5l4.5 4.5M5 19h14" /></svg>

export default function Ledger() {
  const { scans, getReport, historyLoading, historyError, total, loadMore } = useDash()
  const [config, setConfig] = useState(null)
  const [selected, setSelected] = useState('')
  const [bundle, setBundle] = useState(null)
  const [verified, setVerified] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [setupError, setSetupError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    fetch('/ledger-config.json', { cache: 'no-store' }).then((r) => {
      if (!r.ok) throw new Error('Registry is not configured. Run the local chain and deployment commands in docs/ledger.md.')
      return r.json()
    }).then(setConfig).catch((e) => setSetupError(e.message))
  }, [])
  const wallet = () => {
    if (!window.ethereum) throw new Error('Connect an Ethereum browser wallet to use the registry.')
    return new BrowserProvider(window.ethereum)
  }
  const perform = async (name, action) => {
    setBusy(name); setError(''); setNotice(''); setVerified(null)
    try { await action() }
    catch (e) { setError(e.shortMessage || e.message || 'Registry operation failed. Please retry.') }
    finally { setBusy('') }
  }
  const prepare = () => perform('Preparing', async () => {
    const snapshot = createSnapshot(await getReport(selected))
    setBundle({ snapshot, registration: null })
    setNotice('Snapshot prepared. Export a backup before registering; this file is required for verification.')
  })
  const register = () => perform('Waiting for wallet and confirmation', async () => {
    const provider = wallet()
    const contract = await checkedRegistry(provider, config, await provider.getSigner())
    const digest = snapshotDigest(bundle.snapshot)
    const tx = await contract.register(digest)
    const next = { ...bundle, registration: { chainId: String(config.chainId), address: config.address, digest, transactionHash: tx.hash } }
    setBundle(next)
    setNotice(`Transaction submitted: ${tx.hash}. Export the receipt to keep a recovery copy.`)
    await tx.wait()
    setVerified(await verifyBundle(provider, config, next))
    setNotice('Registration confirmed. Export the receipt to preserve your report and verification proof.')
  })
  const verify = () => perform('Verifying', async () => {
    setVerified(await verifyBundle(wallet(), config, bundle))
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
    <section className="card panel ledger-panel">
      <div className="ledger-head"><div><h2 className="panel__title">Report integrity registry</h2><p className="caption grey">Only a salted fingerprint is recorded on-chain. Report contents remain in your exported file. Registration proves integrity and provenance, not whether a website is malicious.</p></div><span className={`ledger-status${config ? ' ledger-status--on' : ''}`}><i />{config ? 'Registry connected' : setupError ? 'Registry not connected' : 'Checking registry'}</span></div>
      {config && <p className="caption grey ledger-address">Chain {config.chainId} · Registry <code>{config.address}</code></p>}
      {setupError && <div className="ledger-alert" role="status"><AlertIcon /><div><strong>Registry not connected</strong><p className="caption grey">{setupError}</p></div></div>}
      <label className="ledger-field">Saved investigation
        <span className="ledger-select"><select className="input-sm" value={selected} disabled={!!busy} onChange={(e) => { setSelected(e.target.value); setBundle(null); setVerified(null); setNotice('') }}>
          <option value="">Choose a report</option>
          {scans.map((scan) => <option key={scan.id} value={scan.id}>{scan.normalized_url} — {scan.risk_classification}</option>)}
        </select></span>
      </label>
      {!scans.length && !historyError && <p className="caption grey">{historyLoading ? 'Loading saved reports…' : 'Run a URL investigation to prepare your first report.'}</p>}
      {historyError && <div className="ledger-alert" role="alert"><AlertIcon /><div><strong>Saved reports unavailable</strong><p className="caption grey">{historyError}</p></div></div>}
      {scans.length < total && <button className="btn btn--ghost" disabled={historyLoading || !!busy} onClick={loadMore}>Load more reports</button>}
      <div className="ledger-actions"><button className="btn btn--ink" disabled={!selected || !!busy} onClick={prepare}>Prepare snapshot</button><label className="btn btn--ghost ledger-import"><UploadIcon />Import receipt<input className="ledger-upload" type="file" accept=".json,application/json" disabled={!!busy} onChange={upload} /></label></div>
      {bundle && <div className="ledger-snapshot">
        <p className="caption grey">Snapshot fingerprint</p><code>{snapshotDigest(bundle.snapshot)}</code>
        <div className="ledger-actions"><button className="btn btn--ghost" onClick={() => downloadReport(bundle)}>Export {bundle.registration ? 'receipt' : 'snapshot'}</button><button className="btn btn--ink" disabled={!config || !!busy || !!bundle.registration} onClick={register}>Register with wallet</button><button className="btn btn--ghost" disabled={!config || !!busy || !bundle.registration} onClick={verify}>Verify integrity</button></div>
        {bundle.registration && <p className="caption grey ledger-address">Transaction <code>{bundle.registration.transactionHash}</code></p>}
      </div>}
      {busy && <p className="ledger-message" role="status">{busy}…</p>}
      {error && <p className="ledger-message ledger-message--bad" role="alert">{error}</p>}
      {notice && <p className="ledger-message" role="status">{notice}</p>}
      {verified && <div className="ledger-verified"><strong>Integrity verified</strong><p className="caption grey ledger-address">Registered by {verified.reporter} · Block {verified.blockNumber}</p></div>}
    </section>
  </>
}
