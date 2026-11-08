# Report integrity registry

The Threat ledger now registers real report commitments on an EVM chain. The
repository supplies a reproducible local chain; no paid network or private service
key is required. The sample ledger entries have been removed.

## Sepolia with MetaMask

The project registry is deployed on Ethereum Sepolia (chain 11155111):

- Contract: [`0x5AB0A5fE5026249aDFe1Fb7362C124cdA5296581`](https://sepolia.etherscan.io/address/0x5AB0A5fE5026249aDFe1Fb7362C124cdA5296581)
- Deployment transaction: [`0x94f6a8da67b6f3dc0319b07bb603d0e268f0a61a18773bd84d3a7cf67bb63a10`](https://sepolia.etherscan.io/tx/0x94f6a8da67b6f3dc0319b07bb603d0e268f0a61a18773bd84d3a7cf67bb63a10)
- Deployment block: `12090374`. The successful creation receipt and deployed
  runtime bytecode were verified before publishing `public/registry-sepolia.json`.

Dashboard users can use this registry directly; deploying another copy is optional.

Install the extension from [MetaMask](https://metamask.com/download), create a
wallet, enable test networks and select Ethereum Sepolia. Request free test ETH
from the [Google Cloud faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia).
Keep your recovery phrase private; the app never receives a private key.

In **Dashboard > Threat ledger**:

1. Leave **Ethereum Sepolia** selected and choose **Connect wallet**. Approve
   connection and the network switch in MetaMask. The dashboard shows the account
   and balance.
2. Choose **Deploy registry** and approve the contract-creation transaction in
   MetaMask. This requires test ETH for gas. Wait for **Registry configured**.
3. Choose **Download deployment config**. The file contains only public chain,
   contract and transaction metadata. The configuration is also remembered in this
   browser. A pending deployment can be recovered using **Check deployment** after
   a reload, without deploying again.
4. Select a saved investigation, prepare a snapshot and export a backup. Choose
   **Register with wallet**, approve the registration, and export the receipt.
5. Import the receipt later and choose **Verify integrity**. Sepolia verification
   uses public read-only RPC and does not need MetaMask or a wallet signature.

Contract and transaction links open the Sepolia block explorer. An existing
registry can be selected by address; the app checks that its deployed bytecode
exactly matches the compiled WebAssure contract. Shared configurations are loaded
from `public/registry-sepolia.json`; otherwise this browser's remembered deployment
is used. This setup does not claim a public deployment until a wallet approves
and the transaction confirms. Mainnet deployment is disabled.

`npm.cmd run ledger:compile` regenerates the checked-in artifact from the contract.
`npm.cmd run ledger:deploy -- --help` describes deployment options for a local
signing node. No private-key arguments or app-stored signing credentials are used.
An already-deployed Sepolia registry can be published to the dashboard using:

```powershell
npm.cmd run ledger:publish -- path/to/deployment.json
```

The deployment JSON must contain `chainId`, `address` and `deploymentTransaction`.
The command verifies the runtime bytecode and successful contract-creation receipt
before writing `public/registry-sepolia.json`. This is public deployment metadata,
not a secret. Publishing it makes the same Sepolia registry available to all users
of the site. Commit that public file when deploying the site, or run this command
on the hosting workspace. No wallet signing key is needed for publication.

For independent Sepolia verification, use the exported deployment config:

```powershell
npm.cmd run ledger:verify -- path/to/receipt.json https://ethereum-sepolia-rpc.publicnode.com path/to/registry-11155111.json
```

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
