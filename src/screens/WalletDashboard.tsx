"use client";
import React from "react";

import Badge from "#/components/ui/badge";
import {Button} from "#/components/ui/button";
import Card, {
  CardContent,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";

type Row = {
  id: string
  chain: string
  symbol: string
  name: string
  amount: number
  price: number
  value: number
  change24h: number
}

export default function WalletDashboard() {
  const rows: Row[] = [
    {id: "btc", chain: "Bitcoin", symbol: "BTC", name: "Bitcoin", amount: 0.1123, price: 48032.32, value: 5387.63, change24h: 0.042},
    {id: "eth", chain: "Ethereum", symbol: "ETH", name: "Ethereum", amount: 3.21, price: 3520.02, value: 11307.26, change24h: -0.018},
    {id: "sol", chain: "Solana", symbol: "SOL", name: "Solana", amount: 45.5, price: 148.11, value: 6733.01, change24h: 0.12},
    {id: "usdc", chain: "Base", symbol: "USDC", name: "USD Coin", amount: 2500, price: 1, value: 2500, change24h: 0},
  ]

  const totalValue = rows.reduce((acc, row) => acc + row.value, 0)
  const totalChange = rows.reduce((acc, row) => acc + row.change24h * row.value, 0) / (totalValue || 1)

  const compactCards = [
    {
      label: 'Solde total',
      value: `$${totalValue.toLocaleString(undefined, {maximumFractionDigits: 2})}`,
      change: totalChange,
    },
    {label: 'Revenus staking', value: '$4,120', change: +0.031},
    {label: 'Achats ce mois', value: '$2,480', change: -0.014},
    {label: 'Frais gas', value: '$92', change: -0.22},
  ]

  const market = rows.slice(0, 4)

  return (
    <div className="dashboard mx-auto w-full max-w-6xl space-y-8">
      <section className="flex flex-col items-center gap-6 text-center">
        <Card className="relative w-full max-w-4xl overflow-hidden bg-gradient-to-br from-brand-600 via-brand-500 to-brand-400 text-primary-foreground shadow-card">
          <div
            className="absolute inset-0 opacity-35"
            style={{background: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,.45), transparent 60%)'}}
          />
          <CardContent className="relative flex flex-col items-center gap-6 pt-7">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-white/70">Solde global</p>
              <p className="text-5xl font-semibold tracking-tight sm:text-6xl">
                ${totalValue.toLocaleString(undefined, {maximumFractionDigits: 2})}
              </p>
              <Badge className={totalChange < 0 ? 'bg-[rgba(239,68,68,.15)] text-destructive' : 'bg-[rgba(34,197,94,.18)] text-success'}>
                {(totalChange * 100 >= 0 ? '+' : '') + (totalChange * 100).toFixed(2)}% sur 24h
              </Badge>
            </div>
            <div className="w-full rounded-xl border border-white/30 bg-white/10 p-4">
              <svg viewBox="0 0 320 110" className="h-24 w-full">
                <path
                  d="M0 82 L18 76 L36 82 L54 60 L72 68 L90 54 L108 60 L126 54 L144 68 L162 60 L180 72 L198 84 L216 78 L234 88 L252 82 L270 92 L288 86 L306 96 L320 90"
                  fill="none"
                  stroke="rgba(255,255,255,0.85)"
                  strokeWidth="3"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Button className="bg-white text-brand-600 hover:bg-white/90">Actualiser</Button>
              <Button className="bg-white/20 text-white hover:bg-white/30">Exporter</Button>
              <Button variant="ghost" className="border border-white/30 bg-white/10 text-white hover:bg-white/20">
                Gérer les alertes
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid w-full max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {compactCards.map(card => (
            <Card key={card.label} className="shadow-card bg-surface/90 text-left">
              <CardContent className="space-y-4 pt-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{card.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{card.value}</p>
                </div>
                <Badge className={card.change < 0 ? 'bg-[rgba(239,68,68,.12)] text-destructive' : 'bg-[rgba(34,197,94,.12)] text-success'}>
                  {(card.change * 100 >= 0 ? '+' : '') + (card.change * 100).toFixed(2)}%
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="shadow-card bg-surface">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Aperçu du portefeuille</CardTitle>
            <p className="text-sm text-muted-foreground">
              Performances synthétiques et répartition par actifs.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-xl border border-border">
              <Table>
                <TableHeader className="bg-card">
                  <TableRow>
                    <TableHead className="pl-4">Coin</TableHead>
                    <TableHead>Réseau</TableHead>
                    <TableHead>Quantité</TableHead>
                    <TableHead>Prix</TableHead>
                    <TableHead>Valeur</TableHead>
                    <TableHead className="pr-4 text-right">24h</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(row => (
                    <TableRow key={row.id}>
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface2 text-[10px] font-semibold text-muted-foreground">
                            {row.symbol.slice(0, 4)}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{row.symbol}</p>
                            <p className="text-xs text-muted-foreground">{row.name}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{row.chain}</TableCell>
                      <TableCell>{row.amount.toLocaleString(undefined, {maximumFractionDigits: 6})}</TableCell>
                      <TableCell>${row.price.toLocaleString(undefined, {maximumFractionDigits: 2})}</TableCell>
                      <TableCell className="font-medium">${row.value.toLocaleString(undefined, {maximumFractionDigits: 2})}</TableCell>
                      <TableCell className={`pr-4 text-right font-semibold ${row.change24h < 0 ? 'text-destructive' : 'text-success'}`}>
                        {(row.change24h * 100 >= 0 ? '+' : '') + (row.change24h * 100).toFixed(2)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card bg-surface">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Live Market</CardTitle>
              <Button variant="ghost" className="h-9 rounded-lg border border-border px-3 text-xs text-muted-foreground hover:text-foreground">
                Voir plus
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Suivez les variations des paires principales.</p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {market.map(row => (
                <li
                  key={`market-${row.id}`}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface2 px-3 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-[10px] font-semibold text-muted-foreground">
                      {row.symbol.slice(0, 3)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{row.symbol}</p>
                      <p className="text-xs text-muted-foreground">{row.chain}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">${row.price.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                    <p className={`text-xs ${row.change24h < 0 ? 'text-destructive' : 'text-success'}`}>
                      {(row.change24h * 100 >= 0 ? '+' : '') + (row.change24h * 100).toFixed(2)}%
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map(row => (
          <Card key={`insight-${row.id}`} className="shadow-card bg-surface/90">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{row.symbol}</p>
                  <p className="mt-2 text-lg font-semibold text-foreground">${row.value.toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                </div>
                <Badge className={row.change24h < 0 ? 'bg-[rgba(239,68,68,.12)] text-destructive' : 'bg-[rgba(34,197,94,.12)] text-success'}>
                  {(row.change24h * 100 >= 0 ? '+' : '') + (row.change24h * 100).toFixed(2)}%
                </Badge>
              </div>
              <div className="mt-4 rounded-lg border border-border bg-surface2 p-2">
                <svg viewBox="0 0 140 50" className="h-10 w-full">
                  <path
                    d="M0 35 L14 33 L28 34 L42 28 L56 30 L70 22 L84 28 L98 24 L112 32 L126 28 L140 30"
                    fill="none"
                    stroke="hsl(var(--chart-stroke))"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  )
}
