import {EVM_TOKENS, type EvmNetworkKey} from '#/config/evm'

export type MarketSnapshot = {
  id: string
  symbol: string
  name: string
  priceUsd: number
  change24hPct?: number
  sparkline?: number[]
  imageUrl?: string
}

export type MarketChart = {
  points: number[]
  prices: number[]
  updatedAt: string
}

const SNAPSHOT_TTL = 15_000
const CHART_TTL = 30_000

const snapshotCache = new Map<string, {ts: number; data: MarketSnapshot[]}>()
const chartCache = new Map<string, {ts: number; data: MarketChart}>()

const COINGECKO_META: Record<string, {symbol: string; name: string}> = {
  bitcoin: {symbol: 'BTC', name: 'Bitcoin'},
  ethereum: {symbol: 'ETH', name: 'Ethereum'},
  'usd-coin': {symbol: 'USDC', name: 'USD Coin'},
  'bridged-usd-coin-base': {symbol: 'USDbC', name: 'USD Base Coin'},
  solana: {symbol: 'SOL', name: 'Solana'},
}

export const DEFAULT_WATCHLIST_IDS = [
  'bitcoin',
  'ethereum',
  'usd-coin',
  'solana',
]

const normalizeSparkline = (prices: number[]) => {
  if (!prices.length) return []
  let min = prices[0]
  let max = prices[0]
  for (const price of prices) {
    if (price < min) min = price
    if (price > max) max = price
  }
  const range = max - min || 1
  return prices.map(price => (price - min) / range)
}

export const resolveTokenCoingeckoId = (
  tokenId: string,
  chainKey?: EvmNetworkKey,
): string | null => {
  if (!chainKey) return null
  const match = EVM_TOKENS[chainKey].find(token => token.id === tokenId)
  return match?.coingeckoId || null
}

export const resolveCoingeckoMeta = (id: string) => {
  return COINGECKO_META[id] || {symbol: id.toUpperCase(), name: id}
}

export async function getMarketSnapshot(ids: string[]) {
  const unique = Array.from(new Set(ids.filter(Boolean)))
  if (!unique.length) return []
  const cacheKey = unique.slice().sort().join(',')
  const cached = snapshotCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < SNAPSHOT_TTL) {
    return cached.data
  }

  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(
    unique.join(','),
  )}&sparkline=true&price_change_percentage=24h`

  const r = await fetch(url)
  if (!r.ok) throw new Error('market_snapshot_failed')
  const data = (await r.json()) as Array<{
    id: string
    symbol: string
    name: string
    current_price: number
    price_change_percentage_24h: number | null
    sparkline_in_7d?: {price: number[]}
    image?: string
  }>

  const normalized = data.map(item => ({
    id: item.id,
    symbol: item.symbol?.toUpperCase() || resolveCoingeckoMeta(item.id).symbol,
    name: item.name || resolveCoingeckoMeta(item.id).name,
    priceUsd: item.current_price,
    change24hPct:
      typeof item.price_change_percentage_24h === 'number'
        ? item.price_change_percentage_24h / 100
        : undefined,
    sparkline: normalizeSparkline(item.sparkline_in_7d?.price || []),
    imageUrl: item.image,
  }))

  snapshotCache.set(cacheKey, {ts: Date.now(), data: normalized})
  return normalized
}

export async function getMarketChart(id: string, days: number | 'max') {
  const cacheKey = `${id}:${days}`
  const cached = chartCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CHART_TTL) {
    return cached.data
  }

  const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`
  const r = await fetch(url)
  if (!r.ok) throw new Error('market_chart_failed')
  const data = (await r.json()) as {prices: [number, number][]}
  const prices = data.prices?.map(point => point[1]) || []
  const points = normalizeSparkline(prices)
  const chart: MarketChart = {
    prices,
    points,
    updatedAt: new Date().toISOString(),
  }
  chartCache.set(cacheKey, {ts: Date.now(), data: chart})
  return chart
}
