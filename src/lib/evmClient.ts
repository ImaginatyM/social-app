// src/lib/evmClient.ts
import {createPublicClient, http, fallback, custom, type Address} from 'viem'
import {base, mainnet} from 'viem/chains'

/** Détecte explicitement MetaMask (utile sur Brave/multi-providers) */
export function getMetaMask(): any | null {
  const w = window as any
  const eth = w?.ethereum
  if (!eth) return null
  if (eth.providers?.length) {
    const mm = eth.providers.find((p: any) => p.isMetaMask)
    return mm || null
  }
  return eth.isMetaMask ? eth : null
}

export type WalletEvmChain = 'base' | 'ethereum'
export type MetaMaskConnectResult = {
  address?: string
  chain: WalletEvmChain | 'unsupported'
  chainId?: string
  message?: string
}

export function mapChainId(chainId?: string): WalletEvmChain | 'unsupported' {
  if (!chainId) return 'unsupported'
  const normalized = chainId.toLowerCase()
  const numeric = chainId.startsWith('0x')
    ? Number.parseInt(chainId, 16)
    : Number(chainId)
  if (normalized === '0x1' || numeric === 1) return 'ethereum'
  if (normalized === '0x2105' || numeric === 8453) return 'base'
  return 'unsupported'
}

export async function connectMetaMask(): Promise<MetaMaskConnectResult> {
  if (typeof window === 'undefined') {
    return {chain: 'unsupported', message: 'metamask_unavailable'}
  }
  const provider = getMetaMask()
  if (!provider) {
    return {chain: 'unsupported', message: 'metamask_not_detected'}
  }
  const accounts = (await provider.request({
    method: 'eth_requestAccounts',
  })) as string[]
  const address = accounts?.[0]
  const chainId = (await provider.request({
    method: 'eth_chainId',
  })) as string | undefined
  if (!address) {
    return {chain: 'unsupported', chainId, message: 'metamask_no_account'}
  }
  const chain = mapChainId(chainId)
  if (chain === 'unsupported') {
    return {
      address,
      chain,
      chainId,
      message: 'unsupported_chain',
    }
  }
  return {address, chain, chainId}
}

/** Clients fallback publics (rank + retry) */
export const publicEthClient = createPublicClient({
  chain: mainnet,
  transport: fallback(
    [
      http('https://cloudflare-eth.com'),
      http('https://ethereum.publicnode.com'),
      http('https://1rpc.io/eth'),
    ],
    {rank: true, retryCount: 2},
  ),
})

export const publicBaseClient = createPublicClient({
  chain: base,
  transport: fallback(
    [
      http('https://mainnet.base.org'),
      http('https://base-rpc.publicnode.com'),
      http('https://1rpc.io/base'),
    ],
    {rank: true, retryCount: 2},
  ),
})

/** Optionnel: si tu as des clés Alchemy, active ces clients managés (plus stables) */
export const managedEthClient = () => {
  const key =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_ALCHEMY_ETH_KEY) || ''
  return key
    ? createPublicClient({
        chain: mainnet,
        transport: http(`https://eth-mainnet.g.alchemy.com/v2/${key}`),
      })
    : null
}
export const managedBaseClient = () => {
  const key =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_ALCHEMY_BASE_KEY) || ''
  return key
    ? createPublicClient({
        chain: base,
        transport: http(`https://base-mainnet.g.alchemy.com/v2/${key}`),
      })
    : null
}

/** Fabrique un client lecture:
 * - priorité au provider MetaMask (RPC de l’utilisateur)
 * - sinon client managé (Alchemy si clé présente)
 * - sinon fallback public (PublicNode/1rpc)
 */
export function getClient(chain: 'eth' | 'base') {
  const mm = typeof window !== 'undefined' ? getMetaMask() : null
  if (mm) {
    return createPublicClient({
      chain: chain === 'base' ? base : mainnet,
      transport: custom(mm),
    })
  }
  if (chain === 'base') {
    return managedBaseClient() ?? publicBaseClient
  }
  return managedEthClient() ?? publicEthClient
}

/** Helper: lit le solde en wei (BigInt).
 * address: 0x…
 * chain: 'eth' | 'base'
 */
export async function getBalanceWei(
  address: Address,
  chain: 'eth' | 'base' = 'eth',
) {
  const client = getClient(chain)
  return client.getBalance({address})
}

export type SupportedChain = 'eth' | 'base'

/** Utilitaire pratique si tu as un state "network" dans ton store */
export async function safeGetBalance(address: string, network?: string) {
  const addr = address as Address
  const chain: SupportedChain = network === 'base' ? 'base' : 'eth'
  try {
    return await getBalanceWei(addr, chain)
  } catch (e: any) {
    // Second essai: si MetaMask posait souci, force fallback public
    try {
      const client = chain === 'base' ? publicBaseClient : publicEthClient
      return await client.getBalance({address: addr})
    } catch (e2) {
      console.error('getBalance failed', {e, e2})
      throw e2
    }
  }
}
