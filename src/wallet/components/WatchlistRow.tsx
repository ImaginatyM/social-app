import React from 'react'
import {Pressable, Text, View} from 'react-native'

import {Sparkline} from './Sparkline'
import {CoinAvatar} from './CoinAvatar'

type Props = {
  symbol: string
  name: string
  priceUsd?: number
  change24hPct?: number
  sparkline?: number[]
  imageUrl?: string
  watched: boolean
  onToggleWatch: () => void
  onPress: () => void
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

export function WatchlistRow({
  symbol,
  name,
  priceUsd,
  change24hPct,
  sparkline,
  imageUrl,
  watched,
  onToggleWatch,
  onPress,
}: Props) {
  const changeColor =
    typeof change24hPct === 'number'
      ? change24hPct >= 0
        ? 'text-emerald-400'
        : 'text-red-400'
      : 'text-slate-400'
  const sparklineColor =
    typeof change24hPct === 'number' && change24hPct < 0
      ? '#f87171'
      : '#34d399'

  return (
    <View className="w-full flex-row items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
      <Pressable
        onPress={onPress}
        className="flex-1 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <CoinAvatar symbol={symbol} imageUrl={imageUrl} size={40} />
          <View>
            <Text className="text-sm font-semibold text-slate-100">{symbol}</Text>
            <Text className="text-xs text-slate-400">{name}</Text>
          </View>
        </View>
        <View className="items-end gap-2">
          <Sparkline points={sparkline} color={sparklineColor} />
          <Text className="text-sm font-semibold text-slate-100">
            {formatUsd(priceUsd)}
          </Text>
          <Text className={`text-xs ${changeColor}`}>
            {formatPct(change24hPct)}
          </Text>
        </View>
      </Pressable>
      <Pressable
        onPress={onToggleWatch}
        className="ml-4 rounded-lg border border-slate-700 px-2 py-1">
        <Text className="text-xs text-slate-200">
          {watched ? 'Retirer' : 'Suivre'}
        </Text>
      </Pressable>
    </View>
  )
}
