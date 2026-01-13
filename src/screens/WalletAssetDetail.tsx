import React from 'react'
import {
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'
import {useRoute} from '@react-navigation/native'

import * as Layout from '#/components/Layout'
import {useMetaMask} from '#/hooks/useMetaMask'
import {usePortfolioData} from '#/hooks/usePortfolioData'
import {
  getMarketChart,
  getMarketSnapshot,
  resolveCoingeckoMeta,
} from '#/wallet/marketData'
import {Sparkline} from '#/wallet/components/Sparkline'
import {TradePanel} from '#/wallet/components/TradePanel'
import {CoinAvatar} from '#/wallet/components/CoinAvatar'

type RouteParams = {
  assetId: string
  symbol?: string
  chainId?: string
}

const RANGE_OPTIONS = [
  {key: '1H', days: 1},
  {key: '1J', days: 1},
  {key: '1S', days: 7},
  {key: '1M', days: 30},
  {key: '1A', days: 365},
  {key: 'Tout', days: 'max' as const},
]

const formatUsd = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return `$${value.toLocaleString('en-US', {maximumFractionDigits: 2})}`
}

const formatPct = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  const pct = value * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
}

export default function WalletAssetDetail() {
  const route = useRoute()
  const params = (route.params || {}) as RouteParams
  const assetId = params.assetId
  if (!assetId) {
    return (
      <Layout.Screen>
        <Layout.Content>
          <View className="w-full max-w-6xl self-center px-4 pb-16">
            <Text className="text-sm text-slate-400">
              Asset indisponible.
            </Text>
          </View>
        </Layout.Content>
      </Layout.Screen>
    )
  }
  const meta = resolveCoingeckoMeta(assetId)
  const {width} = useWindowDimensions()
  const isDesktop = width >= 1024
  const horizontalPadding = isDesktop ? 24 : 16
  const contentMaxWidth = 1200
  const rightPanelWidth = 400
  const chartHeight = isDesktop ? 300 : 260

  const {provider, address, chainId} = useMetaMask()
  const {tokens} = usePortfolioData({
    provider,
    address,
    chainId,
  })

  const [range, setRange] = React.useState(RANGE_OPTIONS[1])
  const [chartPoints, setChartPoints] = React.useState<number[]>([])
  const [price, setPrice] = React.useState<number | undefined>()
  const [change24h, setChange24h] = React.useState<number | undefined>()
  const [imageUrl, setImageUrl] = React.useState<string | undefined>()

  React.useEffect(() => {
    let mounted = true
    const load = async () => {
      const [snapshot] = await getMarketSnapshot([assetId])
      if (!mounted) return
      setPrice(snapshot?.priceUsd)
      setChange24h(snapshot?.change24hPct)
      setImageUrl(snapshot?.imageUrl)
    }
    load().catch(() => {})
    const timer = setInterval(() => load().catch(() => {}), 15_000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [assetId])

  React.useEffect(() => {
    let mounted = true
    getMarketChart(assetId, range.days)
      .then(chart => {
        if (!mounted) return
        setChartPoints(chart.points)
      })
      .catch(() => {
        if (!mounted) return
        setChartPoints([])
      })
    return () => {
      mounted = false
    }
  }, [assetId, range])

  const [chartWidth, setChartWidth] = React.useState(0)
  const availableChartWidth =
    Math.min(width, contentMaxWidth) -
    horizontalPadding * 2 -
    (isDesktop ? rightPanelWidth + 24 : 0)
  const fallbackChartWidth = Math.max(
    240,
    Math.min(760, availableChartWidth),
  )
  const resolvedChartWidth = chartWidth || fallbackChartWidth

  const balanceRow = tokens.find(
    token => token.symbol.toLowerCase() === meta.symbol.toLowerCase(),
  )
  const balanceValue = balanceRow?.balance
  const balanceFloat = balanceValue ? Number.parseFloat(balanceValue) : NaN
  const balanceFiat =
    typeof price === 'number' && Number.isFinite(balanceFloat)
      ? balanceFloat * price
      : undefined

  const assetsForTrade = [
    {id: assetId, symbol: meta.symbol, name: meta.name},
  ]
  const portfolioTotal = tokens.reduce((total, token) => {
    const balance = Number.parseFloat(token.balance)
    if (!Number.isFinite(balance) || typeof token.priceUsd !== 'number') {
      return total
    }
    return total + balance * token.priceUsd
  }, 0)
  const portfolioPct =
    portfolioTotal > 0 && typeof balanceFiat === 'number'
      ? balanceFiat / portfolioTotal
      : undefined

  const tradePanel = (
    <TradePanel
      assets={assetsForTrade}
      address={address}
      chainId={chainId}
      isDesktop={isDesktop}
    />
  )

  return (
    <Layout.Screen>
      <Layout.Content centerStyle={{maxWidth: contentMaxWidth}}>
        <View
          className="w-full self-center pb-16"
          style={{paddingHorizontal: horizontalPadding, paddingTop: 24}}>
          <View
            className={`mb-6 ${
              isDesktop
                ? 'flex-row items-center justify-between'
                : 'flex-col items-start gap-4'
            }`}>
            <View className="flex-row items-center gap-3">
              <CoinAvatar symbol={meta.symbol} imageUrl={imageUrl} size={44} />
              <View>
                <Text className="text-2xl font-semibold text-slate-100">
                  {meta.name}
                </Text>
                <Text className="text-sm text-slate-400">{meta.symbol}</Text>
              </View>
            </View>
            <View className={isDesktop ? 'items-end' : 'items-start'}>
              <Text className="text-xl font-semibold text-slate-100">
                {formatUsd(price)}
              </Text>
              <Text
                className={`text-sm ${
                  typeof change24h === 'number'
                    ? change24h >= 0
                      ? 'text-emerald-400'
                      : 'text-red-400'
                    : 'text-slate-400'
                }`}>
                {formatPct(change24h)}
              </Text>
            </View>
          </View>

          <View
            className={`gap-6 ${isDesktop ? 'flex-row' : 'flex-col'}`}
            style={{alignItems: isDesktop ? 'flex-start' : 'stretch'}}>
            <View className="flex-1 gap-6" style={{minWidth: 0}}>
              <View className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <View className="flex-row flex-wrap gap-2">
                  {RANGE_OPTIONS.map(option => (
                    <Pressable
                      key={option.key}
                      onPress={() => setRange(option)}
                      className={`rounded-lg px-3 py-2 ${
                        range.key === option.key
                          ? 'bg-slate-800'
                          : 'bg-transparent'
                      }`}>
                      <Text className="text-xs text-slate-200">
                        {option.key}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View
                  className="mt-6"
                  style={{width: '100%'}}
                  onLayout={event => {
                    const nextWidth = Math.max(
                      240,
                      Math.round(event.nativeEvent.layout.width),
                    )
                    setChartWidth(prev =>
                      prev === nextWidth ? prev : nextWidth,
                    )
                  }}>
                  <Sparkline
                    points={chartPoints}
                    width={resolvedChartWidth}
                    height={chartHeight}
                    color={
                      typeof change24h === 'number' && change24h < 0
                        ? '#f87171'
                        : '#34d399'
                    }
                  />
                </View>
              </View>

              {!isDesktop ? tradePanel : null}

              <View className="flex-row flex-wrap gap-4">
                {[
                  {
                    label: 'Solde',
                    value: `${balanceValue || '—'} ${meta.symbol}`,
                    sub: formatUsd(balanceFiat),
                  },
                  {
                    label: 'Perf 24h',
                    value: formatPct(change24h),
                    sub: 'Sur 24h',
                  },
                  {
                    label: 'Cout moyen',
                    value: '—',
                    sub: 'Donnees a venir',
                  },
                  {
                    label: '% portefeuille',
                    value:
                      typeof portfolioPct === 'number'
                        ? `${(portfolioPct * 100).toFixed(2)}%`
                        : '—',
                    sub:
                      typeof balanceFiat === 'number'
                        ? formatUsd(balanceFiat)
                        : 'Donnees a venir',
                  },
                ].map(card => (
                  <View
                    key={card.label}
                    className="rounded-2xl border border-slate-800 bg-slate-900 p-4"
                    style={{
                      flex: 1,
                      minWidth: isDesktop ? 220 : 160,
                    }}>
                    <Text className="text-xs uppercase text-slate-400">
                      {card.label}
                    </Text>
                    <Text className="mt-2 text-lg font-semibold text-slate-100">
                      {card.value}
                    </Text>
                    <Text className="mt-1 text-xs text-slate-400">
                      {card.sub}
                    </Text>
                  </View>
                ))}
              </View>

              <View className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <Text className="text-base font-semibold text-slate-100">
                  Transactions
                </Text>
                <Text className="mt-2 text-sm text-slate-400">
                  Historique a venir.
                </Text>
              </View>
            </View>

            {isDesktop ? (
              <View style={{width: rightPanelWidth, flexShrink: 0}}>
                {tradePanel}
              </View>
            ) : null}
          </View>
        </View>
      </Layout.Content>
    </Layout.Screen>
  )
}
