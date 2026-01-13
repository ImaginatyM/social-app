/** Petits sets de tokens pris en charge (id CoinGecko inclus) */
export const TOKENS = {
  ethereum: [
    { id: 'eth',   coingeckoId: 'ethereum', symbol: 'ETH',  name: 'Ether',    address: null,   decimals: 18 },
    { id: 'usdc',  coingeckoId: 'usd-coin', symbol: 'USDC', name: 'USD Coin', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
    { id: 'usdt',  coingeckoId: 'tether',   symbol: 'USDT', name: 'Tether',   address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
    { id: 'dai',   coingeckoId: 'dai',      symbol: 'DAI',  name: 'Dai',      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
  ],
  base: [
    { id: 'eth-base',  coingeckoId: 'ethereum', symbol: 'ETH',  name: 'Ether (Base)', address: null, decimals: 18 },
    { id: 'usdc-base', coingeckoId: 'usd-coin', symbol: 'USDC', name: 'USD Coin',     address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 }, // USDC native Base
  ],
  solana: [
    { id: 'sol', coingeckoId: 'solana', symbol: 'SOL', name: 'Solana', address: null, decimals: 9 },
  ],
  bitcoin: [
    { id: 'btc', coingeckoId: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', address: null, decimals: 8 },
  ],
} as const
