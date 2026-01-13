import React from 'react'
import {Pressable, ScrollView, Text, View} from 'react-native'

import {CoinAvatar} from './CoinAvatar'

export type AssetRow = {
  id: string
  symbol: string
  name: string
  imageUrl?: string
  chain: string
  balance: string
  priceUsd?: number
  change24hPct?: number
  valueUsd?: number
}

type Props = {
  assets: AssetRow[]
  isDesktop: boolean
  onPressAsset: (asset: AssetRow) => void
}

const formatUsd = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  return `$${value.toLocaleString('en-US', {maximumFractionDigits: 2})}`
}

const formatBalance = (value: string, digits = 6) => {
  const parsed = Number.parseFloat(value)
  if (!Number.isFinite(parsed)) return '—'
  return parsed.toLocaleString('en-US', {maximumFractionDigits: digits})
}

const formatPct = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  const pct = value * 100
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
}

export function AssetTable({assets, isDesktop, onPressAsset}: Props) {
  if (!assets.length) {
    return (
      <View className="rounded-xl border border-slate-800 bg-slate-900 p-6">
        <Text className="text-sm text-slate-400">Aucun asset disponible.</Text>
      </View>
    )
  }

  if (!isDesktop) {
    return (
      <View className="gap-3">
        {assets.map(asset => (
          <Pressable
            key={asset.id}
            onPress={() => onPressAsset(asset)}
            className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <CoinAvatar symbol={asset.symbol} imageUrl={asset.imageUrl} size={36} />
                <View>
                  <Text className="text-sm font-semibold text-slate-100">
                    {asset.symbol}
                  </Text>
                  <Text className="text-xs text-slate-400">{asset.name}</Text>
                </View>
              </View>
              <Text className="text-xs text-slate-400">{asset.chain}</Text>
            </View>
            <View className="mt-3 flex-row items-center justify-between">
              <View>
                <Text className="text-xs text-slate-400">Balance</Text>
                <Text className="text-sm font-semibold text-slate-100">
                  {formatBalance(asset.balance)}
                </Text>
              </View>
              <View>
                <Text className="text-xs text-slate-400">Valeur</Text>
                <Text className="text-sm font-semibold text-slate-100">
                  {formatUsd(asset.valueUsd)}
                </Text>
              </View>
              <View>
                <Text className="text-xs text-slate-400">24h</Text>
                <Text
                  className={`text-sm font-semibold ${
                    typeof asset.change24hPct === 'number'
                      ? asset.change24hPct >= 0
                        ? 'text-emerald-400'
                        : 'text-red-400'
                      : 'text-slate-400'
                  }`}>
                  {formatPct(asset.change24hPct)}
                </Text>
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    )
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View
        style={{minWidth: 840}}
        className="rounded-xl border border-slate-800 bg-slate-900">
        <View className="flex-row border-b border-slate-800 px-4 py-3">
          <Text className="w-56 text-xs uppercase text-slate-400">Asset</Text>
          <Text className="w-24 text-xs uppercase text-slate-400">Reseau</Text>
          <Text className="w-28 text-right text-xs uppercase text-slate-400">
            Balance
          </Text>
          <Text className="w-28 text-right text-xs uppercase text-slate-400">
            Prix
          </Text>
          <Text className="w-28 text-right text-xs uppercase text-slate-400">
            Valeur
          </Text>
          <Text className="w-20 text-right text-xs uppercase text-slate-400">
            24h
          </Text>
        </View>
        {assets.map(asset => (
          <Pressable
            key={asset.id}
            onPress={() => onPressAsset(asset)}
            className="flex-row items-center border-b border-slate-800 px-4 py-3">
            <View className="w-56 flex-row items-center gap-3">
              <CoinAvatar symbol={asset.symbol} imageUrl={asset.imageUrl} size={32} />
              <View>
                <Text className="text-sm font-semibold text-slate-100">
                  {asset.symbol}
                </Text>
                <Text className="text-xs text-slate-400">{asset.name}</Text>
              </View>
            </View>
            <Text className="w-24 text-xs text-slate-400">{asset.chain}</Text>
            <Text className="w-28 text-right text-sm text-slate-100">
              {formatBalance(asset.balance)}
            </Text>
            <Text className="w-28 text-right text-sm text-slate-100">
              {formatUsd(asset.priceUsd)}
            </Text>
            <Text className="w-28 text-right text-sm text-slate-100">
              {formatUsd(asset.valueUsd)}
            </Text>
            <Text
              className={`w-20 text-right text-sm font-semibold ${
                typeof asset.change24hPct === 'number'
                  ? asset.change24hPct >= 0
                    ? 'text-emerald-400'
                    : 'text-red-400'
                  : 'text-slate-400'
              }`}>
              {formatPct(asset.change24hPct)}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  )
}
