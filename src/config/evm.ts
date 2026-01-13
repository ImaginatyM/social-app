export const EVM_NETWORKS = {
  base: {
    id: 8453,
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org', // tu peux remplacer par un RPC perso/infura/alchemy
    explorer: 'https://basescan.org',
    nativeSymbol: 'ETH',
    usdc: {
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC Base
      decimals: 6,
      symbol: 'USDC',
    },
  },
  ethereum: {
    id: 1,
    name: 'Ethereum',
    rpcUrl: 'https://cloudflare-eth.com', // simple public RPC
    explorer: 'https://etherscan.io',
    nativeSymbol: 'ETH',
    usdc: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      decimals: 6,
      symbol: 'USDC',
    },
  },
} as const

export type EvmNetworkKey = keyof typeof EVM_NETWORKS
export const DEFAULT_EVM: EvmNetworkKey = 'base'

export type EvmTokenConfig = {
  id: string
  symbol: string
  name: string
  decimals: number
  address?: string
  coingeckoId: string
  showIfBalance?: boolean
}

export const EVM_TOKENS: Record<EvmNetworkKey, EvmTokenConfig[]> = {
  ethereum: [
    {
      id: 'eth',
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18,
      coingeckoId: 'ethereum',
    },
    {
      id: 'usdc',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      coingeckoId: 'usd-coin',
    },
  ],
  base: [
    {
      id: 'eth',
      symbol: 'ETH',
      name: 'Ether',
      decimals: 18,
      coingeckoId: 'ethereum',
    },
    {
      id: 'usdc',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      coingeckoId: 'usd-coin',
    },
    {
      id: 'usdbc',
      symbol: 'USDbC',
      name: 'USD Base Coin',
      decimals: 6,
      address: '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca',
      coingeckoId: 'bridged-usd-coin-base',
      showIfBalance: true,
    },
  ],
}
