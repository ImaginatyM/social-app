import React from 'react'

import Card, {CardContent, CardHeader, CardTitle} from '#/components/ui/card'
import {Button} from '#/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import {EVM_NETWORKS, type EvmNetworkKey} from '#/config/evm'
import * as Toast from '#/view/com/util/Toast'
import type {TokenRow} from '../hooks/usePortfolioData'

type Props = {
  address: string
  chainId?: string
  chainKey: EvmNetworkKey | 'unsupported'
  tokens: TokenRow[]
  lastUpdated?: string | null
  priceUpdatedAt?: string | null
  priceSource?: string | null
  onRefresh: () => void
}

const formatAddress = (address: string) => {
  if (address.length <= 12) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

const formatUsd = (value?: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? `$${value.toLocaleString('en-US', {maximumFractionDigits: 2})}`
    : '—'

const formatBalance = (value: string, maximumFractionDigits = 6) => {
  const num = Number.parseFloat(value)
  if (!Number.isFinite(num)) return '—'
  return num.toLocaleString('en-US', {maximumFractionDigits})
}

const formatTime = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
}

const changeClass = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'text-muted-foreground'
  if (value > 0) return 'text-success-500'
  if (value < 0) return 'text-danger-500'
  return 'text-muted-foreground'
}

export default function WalletDashboardPro({
  address,
  chainId,
  chainKey,
  tokens,
  lastUpdated,
  priceUpdatedAt,
  priceSource,
  onRefresh,
}: Props) {
  const network = chainKey !== 'unsupported' ? EVM_NETWORKS[chainKey] : null
  const chainIdLabel = chainId
    ? chainId.startsWith('0x')
      ? Number.parseInt(chainId, 16).toString()
      : chainId
    : '—'
  const totalUsd = tokens.reduce((acc, token) => {
    const balance = Number.parseFloat(token.balance)
    if (!Number.isFinite(balance) || typeof token.priceUsd !== 'number') {
      return acc
    }
    return acc + balance * token.priceUsd
  }, 0)
  const hasPricing = tokens.some(token => typeof token.priceUsd === 'number')
  const assetSymbols = tokens.map(token => token.symbol)

  const weightedChange = (() => {
    let changeSum = 0
    let valueSum = 0
    for (const token of tokens) {
      const balance = Number.parseFloat(token.balance)
      if (!Number.isFinite(balance) || typeof token.priceUsd !== 'number') continue
      const value = balance * token.priceUsd
      if (typeof token.change24hPct === 'number') {
        changeSum += token.change24hPct * value
        valueSum += value
      }
    }
    return valueSum ? changeSum / valueSum : undefined
  })()

  const onCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(address)
        Toast.show('Adresse copiee', 'clipboard-check')
      }
    } catch {
      Toast.show('Impossible de copier', 'error')
    }
  }

  return (
    <section className="flex w-full flex-col gap-6">
      <Card className="shadow-card bg-surface">
        <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Adresse
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="font-mono text-sm text-foreground">
                {formatAddress(address)}
              </span>
              <Button variant="outline" size="sm" onClick={onCopy}>
                Copier
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Reseau: {network?.name || 'Inconnu'} ({chainIdLabel})
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Derniere maj: {formatTime(lastUpdated)} · Prix: {priceSource || '—'}{' '}
              {priceSource ? formatTime(priceUpdatedAt) : ''}
            </p>
          </div>
          <Button onClick={onRefresh}>Actualiser</Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-card bg-surface">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Total USD
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">
              {hasPricing ? formatUsd(totalUsd) : '—'}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card bg-surface">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Adresse / Reseau
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold text-foreground">
              {formatAddress(address)}
            </div>
            <div className="text-xs text-muted-foreground">
              {network?.name || 'Inconnu'} · ChainId {chainIdLabel}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card bg-surface">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Assets suivis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-foreground">
              {tokens.length}
            </div>
            <div className="text-xs text-muted-foreground">
              {assetSymbols.length ? assetSymbols.join(', ') : '—'}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-card bg-surface">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              24h
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-semibold ${changeClass(weightedChange)}`}>
              {typeof weightedChange === 'number'
                ? `${weightedChange >= 0 ? '+' : ''}${(weightedChange * 100).toFixed(2)}%`
                : '—'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card bg-surface">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Assets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Reseau</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Price USD</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">24h</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Aucun asset suivi pour le moment.
                    </TableCell>
                  </TableRow>
                ) : (
                  tokens.map(token => {
                    const balanceNumber = Number.parseFloat(token.balance)
                    const value =
                      Number.isFinite(balanceNumber) && typeof token.priceUsd === 'number'
                        ? balanceNumber * token.priceUsd
                        : undefined
                    return (
                      <TableRow key={`${token.chain}-${token.id}`}>
                        <TableCell>
                          <div className="font-medium text-foreground">{token.symbol}</div>
                          <div className="text-xs text-muted-foreground">{token.name}</div>
                        </TableCell>
                        <TableCell>{network?.name || token.chain}</TableCell>
                        <TableCell className="text-right">
                          {formatBalance(
                            token.balance,
                            Math.min(token.decimals, 6),
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatUsd(token.priceUsd)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatUsd(value)}
                        </TableCell>
                        <TableCell className={`text-right ${changeClass(token.change24hPct)}`}>
                          {typeof token.change24hPct === 'number'
                            ? `${token.change24hPct >= 0 ? '+' : ''}${(token.change24hPct * 100).toFixed(2)}%`
                            : '—'}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
