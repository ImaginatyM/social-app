import {BITCOIN, type BitcoinNetwork} from '../../config/chains'

export async function getBitcoinBalance(
  address: string,
  network: BitcoinNetwork = 'mainnet',
): Promise<number> {
  const cfg = BITCOIN[network]
  const res = await fetch(`${cfg.apiBase}/address/${address}`)
  if (!res.ok) {
    throw new Error(`Failed to fetch BTC balance (${res.status})`)
  }
  const data = (await res.json()) as {
    chain_stats: {funded_txo_sum: number; spent_txo_sum: number}
    mempool_stats: {funded_txo_sum: number; spent_txo_sum: number}
  }
  const confirmed = data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum
  const mempool = data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum
  const sats = confirmed + mempool
  return sats / cfg.satsPerBtc
}
