import {useCallback, useEffect, useMemo, useState} from 'react'
import {
  decodeFunctionResult,
  encodeFunctionData,
  formatEther,
  formatUnits,
  hexToBigInt,
} from 'viem'

import {EVM_NETWORKS, EVM_TOKENS, type EvmNetworkKey} from '#/config/evm'
import {mapChainId} from '#/lib/evmClient'
import {ERC20_ABI} from '../lib/erc20Abi'

type Eip1193Provider = {
  request: (args: {method: string; params?: unknown[]}) => Promise<any>
}

export type TokenRow = {
  id: string
  chain: EvmNetworkKey
  symbol: string
  name: string
  address?: string
  decimals: number
  balanceRaw: bigint
  balance: string
  priceUsd?: number
  change24hPct?: number
}

export type UsePortfolioParams = {
  provider?: Eip1193Provider | null
  address?: string
  chainId?: string
}

type TokenMetaCacheEntry = {
  symbol: string
  decimals: number
  ts: number
}

type TokenMetaCache = Record<string, TokenMetaCacheEntry>

type PriceCacheEntry = {
  data: Record<string, {usd: number; usd_24h_change?: number}>
  ts: number
}

type PriceCache = Record<string, PriceCacheEntry>

const TOKEN_META_CACHE_KEY = 'wallet-token-meta-v1'
const TOKEN_META_TTL = 7 * 24 * 60 * 60 * 1000
const PRICE_CACHE_TTL = 60_000
const PRICE_CACHE_KEY = 'wallet-price-cache-v2'

let tokenMetaCache: TokenMetaCache = {}
let tokenMetaCacheLoaded = false
let priceCache: PriceCache = {}
let priceCacheLoaded = false

const loadTokenMetaCache = () => {
  if (tokenMetaCacheLoaded) return
  tokenMetaCacheLoaded = true
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    const raw = window.localStorage.getItem(TOKEN_META_CACHE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as TokenMetaCache
    if (parsed && typeof parsed === 'object') {
      tokenMetaCache = parsed
    }
  } catch {
    // ignore cache parse errors
  }
}

const saveTokenMetaCache = () => {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.setItem(
      TOKEN_META_CACHE_KEY,
      JSON.stringify(tokenMetaCache),
    )
  } catch {
    // ignore storage errors
  }
}

const loadPriceCache = () => {
  if (priceCacheLoaded) return
  priceCacheLoaded = true
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    const raw = window.localStorage.getItem(PRICE_CACHE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as PriceCache
    if (parsed && typeof parsed === 'object') {
      priceCache = parsed
    }
  } catch {
    // ignore cache parse errors
  }
}

const savePriceCache = () => {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(priceCache))
  } catch {
    // ignore storage errors
  }
}

const cacheKey = (chainId: string, address: string) =>
  `${chainId}:${address.toLowerCase()}`

const safeHexToBigInt = (value: string) =>
  hexToBigInt(value === '0x' ? '0x0' : value)

async function getTokenMetadata(
  provider: Eip1193Provider,
  chainId: string,
  address: string,
  fallback: {symbol: string; decimals: number},
) {
  loadTokenMetaCache()
  const key = cacheKey(chainId, address)
  const cached = tokenMetaCache[key]
  if (cached && Date.now() - cached.ts < TOKEN_META_TTL) {
    return cached
  }

  try {
    const decimalsData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'decimals',
    })
    const symbolData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'symbol',
    })
    const [decimalsHex, symbolHex] = await Promise.all([
      provider.request({
        method: 'eth_call',
        params: [{to: address, data: decimalsData}, 'latest'],
      }),
      provider.request({
        method: 'eth_call',
        params: [{to: address, data: symbolData}, 'latest'],
      }),
    ])
    const decimals = Number(
      decodeFunctionResult({
        abi: ERC20_ABI,
        functionName: 'decimals',
        data: decimalsHex,
      }),
    )
    const symbol = decodeFunctionResult({
      abi: ERC20_ABI,
      functionName: 'symbol',
      data: symbolHex,
    }) as string

    const entry = {
      symbol: symbol || fallback.symbol,
      decimals: Number.isFinite(decimals) ? decimals : fallback.decimals,
      ts: Date.now(),
    }
    tokenMetaCache[key] = entry
    saveTokenMetaCache()
    return entry
  } catch (err) {
    return {symbol: fallback.symbol, decimals: fallback.decimals, ts: Date.now()}
  }
}

async function fetchPrices(
  chainKey: EvmNetworkKey,
  ids: string[],
): Promise<{data: Record<string, {usd: number; usd_24h_change?: number}>; ts: number} | null> {
  if (!ids.length) return null
  loadPriceCache()
  const key = `${chainKey}`
  const cached = priceCache[key]
  if (cached && Date.now() - cached.ts < PRICE_CACHE_TTL) {
    return cached
  }

  const uniqueIds = Array.from(new Set(ids))
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(
    uniqueIds.join(','),
  )}&vs_currencies=usd&include_24hr_change=true`
  try {
    const r = await fetch(url)
    if (!r.ok) throw new Error('price_fetch_failed')
    const data = (await r.json()) as Record<
      string,
      {usd: number; usd_24h_change?: number}
    >
    const entry = {data, ts: Date.now()}
    priceCache[key] = entry
    savePriceCache()
    return entry
  } catch {
    return cached || null
  }
}

export function usePortfolioData({
  provider,
  address,
  chainId,
}: UsePortfolioParams) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tokens, setTokens] = useState<TokenRow[]>([])
  const [balancesUpdatedAt, setBalancesUpdatedAt] = useState<string | null>(null)
  const [priceUpdatedAt, setPriceUpdatedAt] = useState<string | null>(null)
  const [priceSource, setPriceSource] = useState<string | null>(null)

  const chainKey = useMemo(() => mapChainId(chainId), [chainId])

  const refresh = useCallback(async () => {
    if (!provider || !address || !chainId) {
      setTokens([])
      setError(null)
      return
    }
    const activeChain = mapChainId(chainId)
    if (activeChain === 'unsupported') {
      setTokens([])
      setError('unsupported_network')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const configTokens = EVM_TOKENS[activeChain]
      type TokenRowInternal = TokenRow & {
        showIfBalance?: boolean
        coingeckoId?: string
      }
      const nativeBalanceHex = (await provider.request({
        method: 'eth_getBalance',
        params: [address, 'latest'],
      })) as string
      const nativeBalance = safeHexToBigInt(nativeBalanceHex)
      const nativeRow: TokenRowInternal = {
        id: 'eth',
        chain: activeChain,
        symbol: EVM_NETWORKS[activeChain].nativeSymbol,
        name: 'Ether',
        decimals: 18,
        balanceRaw: nativeBalance,
        balance: formatEther(nativeBalance),
        coingeckoId: 'ethereum',
      }

      const tokenRows = await Promise.all<TokenRowInternal>(
        configTokens
          .filter(token => token.address)
          .map(async token => {
            const meta = await getTokenMetadata(
              provider,
              chainId,
              token.address!,
              {symbol: token.symbol, decimals: token.decimals},
            )
            const data = encodeFunctionData({
              abi: ERC20_ABI,
              functionName: 'balanceOf',
              args: [address],
            })
            const balanceHex = (await provider.request({
              method: 'eth_call',
              params: [{to: token.address, data}, 'latest'],
            })) as string
            const balanceRaw = safeHexToBigInt(balanceHex)
            return {
              id: token.id,
              chain: activeChain,
              symbol: meta.symbol,
              name: token.name,
              address: token.address,
              decimals: meta.decimals,
              balanceRaw,
              balance: formatUnits(balanceRaw, meta.decimals),
              showIfBalance: token.showIfBalance,
              coingeckoId: token.coingeckoId,
            }
          }),
      )

      const allRows: TokenRowInternal[] = [nativeRow, ...tokenRows]
      const visibleRows = allRows.filter(row => {
        const cfg = configTokens.find(token => token.id === row.id)
        if (cfg?.showIfBalance) {
          return row.balanceRaw > 0n
        }
        return true
      })

      setTokens(
        visibleRows.map(row => ({
          id: row.id,
          chain: row.chain,
          symbol: row.symbol,
          name: row.name,
          address: row.address,
          decimals: row.decimals,
          balanceRaw: row.balanceRaw,
          balance: row.balance,
        })),
      )
      setBalancesUpdatedAt(new Date().toISOString())

      const priceIds = Array.from(
        new Set(configTokens.map(token => token.coingeckoId)),
      )
      const priceEntry = await fetchPrices(activeChain, priceIds)
      if (priceEntry) {
        const nextTokens = visibleRows.map(row => {
          const id = row.coingeckoId || 'ethereum'
          const price = priceEntry.data[id]?.usd
          const change =
            typeof priceEntry.data[id]?.usd_24h_change === 'number'
              ? priceEntry.data[id].usd_24h_change / 100
              : undefined
          return {
            ...row,
            priceUsd: price,
            change24hPct: change,
          }
        })
        setTokens(
          nextTokens.map(row => ({
            id: row.id,
            chain: row.chain,
            symbol: row.symbol,
            name: row.name,
            address: row.address,
            decimals: row.decimals,
            balanceRaw: row.balanceRaw,
            balance: row.balance,
            priceUsd: row.priceUsd,
            change24hPct: row.change24hPct,
          })),
        )
        setPriceUpdatedAt(new Date(priceEntry.ts).toISOString())
        setPriceSource('CoinGecko')
      } else {
        setPriceUpdatedAt(null)
        setPriceSource(null)
      }
    } catch (err: any) {
      setError(err?.message || 'unknown_error')
    } finally {
      setLoading(false)
    }
  }, [address, chainId, provider])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    tokens,
    loading,
    error,
    refresh,
    chainKey,
    balancesUpdatedAt,
    priceUpdatedAt,
    priceSource,
  }
}
