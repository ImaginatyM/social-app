import {type Wallets} from '../state/walletsStore'

export function renderWalletsIntoBio(currentBio: string, w: Wallets) {
  const lines = currentBio?.split('\n').filter(Boolean) ?? []
  const filtered = lines.filter(
    l => !/^ETH\(|^Lightning:|^SOL:|^BTC:/i.test(l.trim()),
  )
  if (w.evm?.address) {
    const net = (w.evm.network || 'base').toUpperCase()
    filtered.push(`ETH(${net}): ${w.evm.address}`)
  }
  if (w.solana?.address) {
    filtered.push(`SOL: ${w.solana.address}`)
  }
  if (w.bitcoin?.address) {
    const net = (w.bitcoin.network || 'mainnet').toUpperCase()
    filtered.push(`BTC(${net}): ${w.bitcoin.address}`)
  }
  if (w.lightning?.address) {
    filtered.push(`Lightning: ${w.lightning.address}`)
  }
  return filtered.join('\n')
}

export function parseWalletsFromBio(bio?: string): Wallets {
  const w: Wallets = {}
  if (!bio) return w
  for (const line of bio.split('\n')) {
    const trimmed = line.trim()
    const ethMatch = trimmed.match(/^ETH\(([^)]+)\):\s*(0x[a-fA-F0-9]{40})/)
    if (ethMatch) {
      w.evm = {
        address: ethMatch[2],
        network: ethMatch[1].toLowerCase() as any,
      }
      continue
    }
    const solMatch = trimmed.match(/^SOL:\s*([A-HJ-NP-Za-km-z1-9]{32,44})/)
    if (solMatch) {
      w.solana = {address: solMatch[1]}
      continue
    }
    const btcMatch = trimmed.match(/^BTC\(([^)]+)\):\s*([13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[0-9a-zA-Z]{11,71})/)
    if (btcMatch) {
      w.bitcoin = {
        address: btcMatch[2],
        network: btcMatch[1].toLowerCase() as any,
      }
      continue
    }
    const lightningMatch = trimmed.match(
      /^Lightning:\s*([^\s@]+@[^\s@]+\.[^\s@]+)/,
    )
    if (lightningMatch) {
      w.lightning = {address: lightningMatch[1]}
    }
  }
  return w
}
