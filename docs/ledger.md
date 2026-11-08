# Report integrity registry

The Threat ledger now registers real report commitments on an EVM chain. The
repository supplies a reproducible local chain; no paid network or private service
key is required. The sample ledger entries have been removed.

## Run locally

From `webassure`, install dependencies with `npm.cmd ci`, then in one terminal:

```powershell
npm.cmd run ledger:chain
```

The chain listens on loopback only at `http://127.0.0.1:8545`, chain ID `31337`.
Its database persists in ignored `data/ledger-chain`. The terminal prints a
deterministic local demo account and private key. These are public test credentials;
never transfer real assets to these accounts or reuse them on public networks.

In a second terminal, from `webassure`:

```powershell
npm.cmd run ledger:deploy
npm.cmd run ledger:demo
npm.cmd run ledger:verify -- ../data/ledger-demo-receipt.json
npm.cmd run dev
```

Deployment writes the address, chain ID, deployment block and transaction to
ignored `webassure/public/ledger-config.json`. This public configuration contains
no credentials. The demo registers a synthetic report and exports a real receipt.
Restarting the chain preserves registrations; redeploying creates a new registry.
Keep the configuration for the registry associated with older receipts.

## Use the dashboard

Add the local network to an Ethereum browser wallet using the RPC and chain ID
above (currency symbol ETH), and import the displayed local-only test account.
Sign into WebAssure and run a URL investigation. Open **Threat ledger**, select
the saved report, and choose **Prepare snapshot**. Export the snapshot as a backup,
then choose **Register with wallet**. Approve the transaction in your wallet.
After confirmation, export the receipt. Import it later and choose **Verify integrity**.
You can also import `data/ledger-demo-receipt.json` to try verification immediately.
Wallet rejection, a wrong network, missing deployment, failed transaction and
altered reports are reported as errors. An exported pending receipt can be verified
again after confirmation. No report contents are published to the chain.

Independent verification needs no login, application server or wallet signature:

```powershell
npm.cmd run ledger:verify -- path/to/receipt.json http://127.0.0.1:8545
```

The CLI reads the trusted registry configuration separately from the imported
receipt, recomputes the fingerprint and verifies the successful transaction,
contract address, registration event, registering address and contract state.
Changing the report, nonce, fingerprint or transaction invalidates verification.
The file contains the full private report: share it only with intended recipients.

## Commitment format v1

The snapshot is `{ schema, nonce, report }`, with schema
`webassure-report-commitment/v1` and a random 32-byte hex nonce. Its fingerprint
is Keccak-256 of UTF-8 canonical JSON. Canonicalization recursively sorts object
keys by JavaScript UTF-16 ordering, preserves array order, and uses JSON.stringify
primitive encoding; non-finite numbers and non-JSON values are rejected. Every
field in the report snapshot is included. This is a project-specific versioned
format, not an assertion of RFC 8785 compliance. The nonce reduces guessing of
report contents from public fingerprints. Later report edits or AI explanations
require a new snapshot; old receipts continue to verify the original snapshot.

The contract stores only fingerprint, reporter wallet and timestamp. A reporter
cannot register the same fingerprint twice; different wallets can independently
register it. Registration and successful verification establish integrity and
wallet provenance, not the truth of the assessment or ownership of a website.
This MVP has no dispute system, revision relationships or public incident feed.

## Message links

Messages keeps extracted links as text until **Investigate link** is selected.
That action uses the same authenticated URL investigation pipeline as Scans,
including existing SSRF protection and redirect checks. The result appears next
to its source link; **View link report** opens the full evidence report, and the
investigation is saved in scan history. Raw message text is not added to the URL
report. Link results do not silently change the message classifier's verdict.
The message-to-result association is kept in the current page session only.

## Implementation references

Wallet and contract interaction use [ethers v6](https://docs.ethers.org/v6/getting-started/).
The registry uses Solidity [mappings and events](https://docs.soliditylang.org/en/latest/contracts.html).
`npm.cmd test` includes actual in-memory EVM deployment, registration, duplicate
rejection, provenance and tamper-detection tests; these are not mocked RPC results.
