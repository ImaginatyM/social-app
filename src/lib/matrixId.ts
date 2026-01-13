export function getMatrixDomainFromBaseUrl(baseUrl: string): string {
  try {
    const u = new URL(baseUrl)
    return u.host // ex: matrix.org
  } catch {
    return 'matrix.org'
  }
}

export function normalizeBskyHandle(handle: string): string {
  // handle peut ressembler à "@user.tellus.social" ou "user.tellus.social"
  let h = handle.trim()
  if (h.startsWith('@')) h = h.slice(1)
  return h.toLowerCase()
}

export function bskyHandleToMatrixId(handle: string, baseUrl: string): string {
  const localpart = normalizeBskyHandle(handle)
  const domain = getMatrixDomainFromBaseUrl(baseUrl)
  return `@${localpart}:${domain}`
}

/*
Exemples rapides :
- bskyHandleToMatrixId('@Alice.Tellus.social', 'https://matrix-client.matrix.org') => '@alice.tellus.social:matrix-client.matrix.org'
- bskyHandleToMatrixId('bob.tellus.social', 'https://matrix.org') => '@bob.tellus.social:matrix.org'
*/
