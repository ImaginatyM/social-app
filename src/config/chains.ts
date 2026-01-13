export const SOLANA = {
  id: 'solana-mainnet',
  name: 'Solana',
  rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  explorer: 'https://solscan.io',
  nativeSymbol: 'SOL',
} as const

export const BITCOIN = {
  mainnet: {
    name: 'Bitcoin',
    apiBase: process.env.BITCOIN_API_BASE || 'https://blockstream.info/api',
    explorer: 'https://mempool.space',
    nativeSymbol: 'BTC',
    satsPerBtc: 1e8,
  },
  testnet: {
    name: 'Bitcoin Testnet',
    apiBase:
      process.env.BITCOIN_TESTNET_API_BASE || 'https://blockstream.info/testnet/api',
    explorer: 'https://mempool.space/testnet',
    nativeSymbol: 'BTC',
    satsPerBtc: 1e8,
  },
} as const

export type BitcoinNetwork = keyof typeof BITCOIN
export type SolanaConfig = typeof SOLANA
