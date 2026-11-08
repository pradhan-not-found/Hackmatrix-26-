export const REGISTRY_NETWORKS = {
  '11155111': { chainId: '11155111', name: 'Ethereum Sepolia', rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com', explorerUrl: 'https://sepolia.etherscan.io', currency: 'ETH', configPath: '/registry-sepolia.json' },
  '31337': { chainId: '31337', name: 'Local demo', rpcUrl: 'http://127.0.0.1:8545', explorerUrl: '', currency: 'ETH', configPath: '/ledger-config.json' },
}

export function registryNetwork(chainId) {
  const network = REGISTRY_NETWORKS[String(chainId)]
  if (!network) throw new Error('Only Ethereum Sepolia and the local demo chain are supported. Mainnet deployment is disabled.')
  return network
}

export function explorerLink(config, type, value) {
  const network = registryNetwork(config.chainId)
  if (!network.explorerUrl || !['tx', 'address'].includes(type)) return null
  if (!(type === 'tx' ? /^0x[0-9a-f]{64}$/i : /^0x[0-9a-f]{40}$/i).test(value || '')) return null
  return `${network.explorerUrl}/${type}/${value}`
}

export async function switchRegistryNetwork(ethereum, chainId) {
  const network = registryNetwork(chainId)
  const hex = `0x${BigInt(network.chainId).toString(16)}`
  if (BigInt(await ethereum.request({ method: 'eth_chainId' })) === BigInt(chainId)) return
  try {
    await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] })
  } catch (error) {
    if (Number(error.code ?? error.data?.originalError?.code) !== 4902) throw error
    await ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: hex, chainName: network.name,
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: [network.rpcUrl],
      ...(network.explorerUrl ? { blockExplorerUrls: [network.explorerUrl] } : {}) }] })
    await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hex }] })
  }
}
