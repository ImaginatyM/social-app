import React from 'react'
import {
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'

import {useNavigation} from '@react-navigation/native'

import {CircleX_Stroke2_Corner0_Rounded as CircleXIcon} from '#/components/icons/CircleX'
import {Loader_Stroke2_Corner0_Rounded as LoaderIcon} from '#/components/icons/Loader'
import {StateCard} from '#/screens/Messages/components/StateCard'
import {usePortfolioData} from '#/hooks/usePortfolioData'
import {isWeb} from '#/platform/detection'
import {type NavigationProp} from '#/lib/routes/types'
import {
  DEFAULT_WATCHLIST_IDS,
  getMarketSnapshot,
  resolveCoingeckoMeta,
  resolveTokenCoingeckoId,
  type MarketSnapshot,
} from '#/wallet/marketData'
import {loadWatchlist, saveWatchlist} from '#/wallet/storage'
import {WatchlistRow} from '#/wallet/components/WatchlistRow'
import {AssetTable, type AssetRow} from '#/wallet/components/AssetTable'
import {TradePanel} from '#/wallet/components/TradePanel'
import {CoinAvatar} from '#/wallet/components/CoinAvatar'
import {searchMarket, type MarketSearchResult} from '#/wallet/marketSearch'

type Eip1193Provider = {
  request: (args: {method: string; params?: unknown[]}) => Promise<any>
}

type Props = {
  provider?: Eip1193Provider | null
  address?: string
  chainId?: string
  isAvailable: boolean
  isConnecting: boolean
  onConnect: () => void
}

const formatUsd = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return `$${value.toLocaleString('en-US', {maximumFractionDigits: 2})}`
}

const formatPct = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  const pct = value * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
}

export default function WalletDashboardContainer({
  provider,
  address,
  chainId,
  isAvailable,
  isConnecting,
  onConnect,
}: Props) {
  const navigation = useNavigation<NavigationProp>()
  const {width} = useWindowDimensions()
  const isDesktop = isWeb && width >= 1024
  const isTablet = isWeb && width >= 768 && width < 1024
  const useTableLayout = isDesktop || isTablet
  const [containerWidth, setContainerWidth] = React.useState(width)
  const [query, setQuery] = React.useState('')
  const [watchlistIds, setWatchlistIds] = React.useState<string[]>(
    DEFAULT_WATCHLIST_IDS,
  )
  const [marketSnapshots, setMarketSnapshots] = React.useState<MarketSnapshot[]>([])
  const [marketError, setMarketError] = React.useState<string | null>(null)
  const [searchResults, setSearchResults] = React.useState<MarketSearchResult[]>([])
  const [searchLoading, setSearchLoading] = React.useState(false)
  const [searchError, setSearchError] = React.useState<string | null>(null)

  const {
    tokens,
    loading,
    error,
    refresh,
    chainKey,
    balancesUpdatedAt,
    priceUpdatedAt,
    priceSource,
  } = usePortfolioData({provider, address, chainId})

  React.useEffect(() => {
    loadWatchlist()
      .then(stored => {
        if (stored?.length) setWatchlistIds(stored)
      })
      .catch(() => {})
  }, [])

  const toggleWatchlist = React.useCallback(async (id: string) => {
    setWatchlistIds(prev => {
      const next = prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
      void saveWatchlist(next)
      return next
    })
  }, [])

  const addToWatchlist = React.useCallback(async (id: string) => {
    setWatchlistIds(prev => {
      if (prev.includes(id)) return prev
      const next = [...prev, id]
      void saveWatchlist(next)
      return next
    })
  }, [])

  const loadMarket = React.useCallback(async () => {
    if (!watchlistIds.length) return
    try {
      const data = await getMarketSnapshot(watchlistIds)
      setMarketSnapshots(data)
      setMarketError(null)
    } catch {
      setMarketError('Impossible de charger les prix.')
    }
  }, [watchlistIds])

  React.useEffect(() => {
    loadMarket()
    const timer = setInterval(loadMarket, 15_000)
    return () => clearInterval(timer)
  }, [loadMarket])

  const marketById = React.useMemo(() => {
    const map = new Map<string, MarketSnapshot>()
    marketSnapshots.forEach(item => map.set(item.id, item))
    return map
  }, [marketSnapshots])

  const search = query.trim()
  const searchLower = search.toLowerCase()

  React.useEffect(() => {
    if (search.length < 2) {
      setSearchResults([])
      setSearchError(null)
      setSearchLoading(false)
      return
    }
    let mounted = true
    setSearchLoading(true)
    const handle = setTimeout(() => {
      searchMarket(search)
        .then(results => {
          if (!mounted) return
          setSearchResults(results.slice(0, 8))
          setSearchError(null)
        })
        .catch(() => {
          if (!mounted) return
          setSearchResults([])
          setSearchError('Recherche indisponible.')
        })
        .finally(() => {
          if (!mounted) return
          setSearchLoading(false)
        })
    }, 250)
    return () => {
      mounted = false
      clearTimeout(handle)
    }
  }, [search])

  const watchlistRows = watchlistIds
    .map(id => {
      const snapshot = marketById.get(id)
      const meta = resolveCoingeckoMeta(id)
      return {
        id,
        symbol: snapshot?.symbol || meta.symbol,
        name: snapshot?.name || meta.name,
        priceUsd: snapshot?.priceUsd,
        change24hPct: snapshot?.change24hPct,
        sparkline: snapshot?.sparkline,
        imageUrl: snapshot?.imageUrl,
      }
    })
    .filter(row =>
      searchLower
        ? row.symbol.toLowerCase().includes(searchLower) ||
          row.name.toLowerCase().includes(searchLower)
        : true,
    )

  const assetRows = React.useMemo<AssetRow[]>(() => {
    if (!tokens.length) return []
    return tokens
      .map(token => {
        const coingeckoId = resolveTokenCoingeckoId(token.id, chainKey)
        const snapshot = coingeckoId ? marketById.get(coingeckoId) : undefined
        const priceUsd = token.priceUsd ?? snapshot?.priceUsd
        const change24hPct = token.change24hPct ?? snapshot?.change24hPct
        const balanceNumber = Number.parseFloat(token.balance)
        const valueUsd =
          Number.isFinite(balanceNumber) && typeof priceUsd === 'number'
            ? balanceNumber * priceUsd
            : undefined
        return {
          id: coingeckoId || token.id,
          symbol: token.symbol,
          name: token.name,
          imageUrl: snapshot?.imageUrl,
          chain:
            chainKey === 'base'
              ? 'Base'
              : chainKey === 'ethereum'
                ? 'Ethereum'
                : 'Inconnu',
          balance: token.balance,
          priceUsd,
          valueUsd,
          change24hPct,
        }
    })
    .filter(row =>
      searchLower
        ? row.symbol.toLowerCase().includes(searchLower) ||
          row.name.toLowerCase().includes(searchLower)
        : true,
    )
  }, [tokens, chainKey, marketById, searchLower])

  const totalUsd = assetRows.reduce((acc, row) => acc + (row.valueUsd || 0), 0)
  const weightedChange = assetRows.reduce(
    (acc, row) =>
      typeof row.change24hPct === 'number' && row.valueUsd
        ? acc + row.change24hPct * row.valueUsd
        : acc,
    0,
  )
  const changeBase = assetRows.reduce(
    (acc, row) => (row.valueUsd ? acc + row.valueUsd : acc),
    0,
  )
  const changePct = changeBase ? weightedChange / changeBase : undefined

  const networkLabel = chainKey === 'base' ? 'Base' : chainKey === 'ethereum' ? 'Ethereum' : '—'

  const onRefresh = () => {
    refresh()
    loadMarket()
  }

  const onPressAsset = (asset: AssetRow) => {
    if (!asset.id) return
    navigation.navigate('WalletAssetDetail', {
      assetId: asset.id,
      symbol: asset.symbol,
      chainId: chainId || undefined,
    })
  }

  const actionAssets = watchlistRows.length
    ? watchlistRows.map(row => ({id: row.id, symbol: row.symbol, name: row.name}))
    : assetRows.map(row => ({id: row.id, symbol: row.symbol, name: row.name}))

  const horizontalPadding = isDesktop || isTablet ? 24 : 16
  const availableWidth = containerWidth || width
  const contentWidth = Math.max(0, availableWidth - horizontalPadding * 2)
  const leftMinWidth = 560
  const desiredRightWidth = Math.round(contentWidth * 0.33)
  const clampedRightWidth = Math.min(
    420,
    Math.max(320, desiredRightWidth),
  )
  const maxRightWidth = contentWidth - leftMinWidth
  const canShowDesktop = isDesktop && maxRightWidth >= 320
  const rightPanelWidth = canShowDesktop
    ? Math.min(clampedRightWidth, maxRightWidth)
    : 0

  return (
    <View
      className="w-full self-center pb-16"
      style={{maxWidth: 1280, paddingHorizontal: horizontalPadding}}
      onLayout={event => {
        const next = Math.round(event.nativeEvent.layout.width)
        if (Number.isFinite(next) && next > 0 && next !== containerWidth) {
          setContainerWidth(next)
        }
      }}>
      <View
        className={`mb-6 ${
          canShowDesktop
            ? 'flex-row items-start justify-between'
            : 'flex-col items-start gap-3'
        }`}>
        <View>
          <Text className="text-2xl font-semibold text-slate-100">Wallet</Text>
          <Text className="text-xs text-slate-400">
            Reseau: {networkLabel} · Derniere maj: {balancesUpdatedAt ? new Date(balancesUpdatedAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '—'}
          </Text>
        </View>
        <View className={canShowDesktop ? 'w-96' : 'w-full'}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher un asset"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            autoCorrect={false}
            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-100"
          />
          {search.length >= 2 ? (
            <View className="mt-2 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
              {searchLoading ? (
                <Text className="px-4 py-3 text-xs text-slate-400">
                  Recherche en cours...
                </Text>
              ) : searchError ? (
                <Text className="px-4 py-3 text-xs text-red-400">
                  {searchError}
                </Text>
              ) : searchResults.length === 0 ? (
                <Text className="px-4 py-3 text-xs text-slate-400">
                  Aucun resultat.
                </Text>
              ) : (
                searchResults.map(result => {
                  const isWatching = watchlistIds.includes(result.id)
                  return (
                    <View
                      key={result.id}
                      className="flex-row items-center justify-between border-b border-slate-800 px-4 py-3">
                      <Pressable
                        onPress={() =>
                          navigation.navigate('WalletAssetDetail', {
                            assetId: result.id,
                            symbol: result.symbol,
                            chainId: chainId || undefined,
                          })
                        }
                        className="flex-1 flex-row items-center gap-3">
                        <CoinAvatar
                          symbol={result.symbol}
                          imageUrl={result.imageUrl}
                          size={32}
                        />
                        <View>
                          <Text className="text-sm font-semibold text-slate-100">
                            {result.symbol}
                          </Text>
                          <Text className="text-xs text-slate-400">
                            {result.name}
                          </Text>
                        </View>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          if (!isWatching) {
                            addToWatchlist(result.id)
                          }
                          setQuery('')
                        }}
                        className={`ml-3 rounded-lg border px-3 py-1 ${
                          isWatching ? 'border-slate-800' : 'border-slate-700'
                        }`}>
                        <Text
                          className={`text-xs ${
                            isWatching ? 'text-slate-400' : 'text-slate-200'
                          }`}>
                          {isWatching ? 'Suivi' : '+ Suivre'}
                        </Text>
                      </Pressable>
                    </View>
                  )
                })
              )}
            </View>
          ) : null}
        </View>
      </View>

      {!address && (
        <View className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <Text className="text-sm font-semibold text-slate-100">
            Connecter MetaMask pour voir vos balances.
          </Text>
          <Text className="mt-1 text-xs text-slate-400">
            Les actions d'achat/vente renvoient vers MetaMask Portfolio.
          </Text>
          <Pressable
            onPress={onConnect}
            disabled={isConnecting || !isAvailable}
            className="mt-3 self-start rounded-lg bg-emerald-500 px-3 py-2">
            <Text className="text-xs font-semibold text-white">
              {isConnecting ? 'Connexion...' : isAvailable ? 'Connecter MetaMask' : 'MetaMask indisponible'}
            </Text>
          </Pressable>
        </View>
      )}

      {error && (
        <StateCard
          title="Erreur de synchronisation"
          description={
            error === 'unsupported_network'
              ? 'Reseau non supporte. Utilisez Base ou Ethereum.'
              : 'Impossible de recuperer les soldes pour le moment.'
          }
          icon={CircleXIcon}
          tone="error"
          action={
            <Pressable onPress={refresh}>
              <Text>Reessayer</Text>
            </Pressable>
          }
        />
      )}

      {loading && tokens.length === 0 && (
        <StateCard
          title="Chargement du wallet"
          description="Recuperation des soldes en cours."
          icon={LoaderIcon}
          tone="info"
        />
      )}

      <View
        className={`gap-6 ${
          canShowDesktop ? 'flex-row items-start' : 'flex-col'
        }`}>
        <View
          style={{
            flex: 1,
            minWidth: canShowDesktop ? leftMinWidth : undefined,
            flexShrink: 1,
          }}
          className="gap-6">
          <View className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xs uppercase text-slate-400">Total</Text>
                <Text className="mt-2 text-3xl font-semibold text-slate-100">
                  {formatUsd(totalUsd)}
                </Text>
                <Text
                  className={`mt-1 text-sm ${
                    typeof changePct === 'number'
                      ? changePct >= 0
                        ? 'text-emerald-400'
                        : 'text-red-400'
                      : 'text-slate-400'
                  }`}>
                  {formatPct(changePct)} sur 24h
                </Text>
              </View>
              <Pressable
                onPress={onRefresh}
                className="rounded-lg border border-slate-700 px-3 py-2">
                <Text className="text-xs text-slate-200">Actualiser</Text>
              </Pressable>
            </View>
            <Text className="mt-4 text-xs text-slate-400">
              Source prix: {priceSource || '—'} · {priceUpdatedAt ? new Date(priceUpdatedAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : '—'}
            </Text>
          </View>

          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-semibold text-slate-100">
                Actifs a surveiller
              </Text>
              {marketError ? (
                <Text className="text-xs text-red-400">{marketError}</Text>
              ) : null}
            </View>
            <View className="gap-3">
              {watchlistRows.length === 0 ? (
                <View className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <Text className="text-sm text-slate-400">
                    Ajoutez des assets a votre watchlist.
                  </Text>
                </View>
              ) : (
                watchlistRows.map(row => (
                  <WatchlistRow
                    key={row.id}
                    symbol={row.symbol}
                    name={row.name}
                    priceUsd={row.priceUsd}
                    change24hPct={row.change24hPct}
                    sparkline={row.sparkline}
                    imageUrl={row.imageUrl}
                    watched={watchlistIds.includes(row.id)}
                    onToggleWatch={() => toggleWatchlist(row.id)}
                    onPress={() =>
                      navigation.navigate('WalletAssetDetail', {
                        assetId: row.id,
                        symbol: row.symbol,
                        chainId: chainId || undefined,
                      })
                    }
                  />
                ))
              )}
            </View>
          </View>

          <View className="gap-3">
            <Text className="text-base font-semibold text-slate-100">Assets</Text>
            <AssetTable
              assets={assetRows}
              isDesktop={useTableLayout}
              onPressAsset={onPressAsset}
            />
          </View>
        </View>

        {canShowDesktop ? (
          <View
            style={{
              width: rightPanelWidth,
              minWidth: 320,
              maxWidth: 420,
              flexShrink: 0,
            }}>
            <TradePanel
              assets={actionAssets}
              address={address}
              chainId={chainId}
              isDesktop={canShowDesktop}
            />
          </View>
        ) : null}
      </View>

      {!canShowDesktop ? (
        <TradePanel
          assets={actionAssets}
          address={address}
          chainId={chainId}
          isDesktop={canShowDesktop}
        />
      ) : null}
    </View>
  )
}
