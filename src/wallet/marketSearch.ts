export type MarketSearchResult = {
  id: string
  symbol: string
  name: string
  imageUrl?: string
  marketCapRank?: number | null
}

const SEARCH_TTL = 60_000
const searchCache = new Map<string, {ts: number; data: MarketSearchResult[]}>()

export async function searchMarket(query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []

  const cached = searchCache.get(normalized)
  if (cached && Date.now() - cached.ts < SEARCH_TTL) {
    return cached.data
  }

  const url = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(
    normalized,
  )}`
  const r = await fetch(url)
  if (!r.ok) throw new Error('market_search_failed')
  const data = (await r.json()) as {
    coins?: Array<{
      id: string
      name: string
      symbol: string
      thumb?: string
      large?: string
      market_cap_rank?: number | null
    }>
  }

  const results = (data.coins || [])
    .map(item => ({
      id: item.id,
      symbol: item.symbol?.toUpperCase() || item.id.toUpperCase(),
      name: item.name || item.id,
      imageUrl: item.large || item.thumb,
      marketCapRank: item.market_cap_rank ?? null,
    }))
    .sort((a, b) => {
      if (a.marketCapRank == null && b.marketCapRank == null) return 0
      if (a.marketCapRank == null) return 1
      if (b.marketCapRank == null) return -1
      return a.marketCapRank - b.marketCapRank
    })

  searchCache.set(normalized, {ts: Date.now(), data: results})
  return results
}
