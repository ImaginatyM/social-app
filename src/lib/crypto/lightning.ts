export function isLightningAddress(s?: string) {
  if (!s) return false
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)
}

// Génère un lien lightning simple (pour wallet compatibles)
export function toLightningUrl(
  addr: string,
  amountSats?: number,
  memo?: string,
) {
  // Les wallets modernes gèrent lightning:<adresse> (Lightning Address) ou lnurl
  const p = new URLSearchParams()
  if (amountSats) p.set('amount', String(amountSats))
  if (memo) p.set('memo', memo)
  return `lightning:${addr}${p.toString() ? `?${p.toString()}` : ''}`
}
