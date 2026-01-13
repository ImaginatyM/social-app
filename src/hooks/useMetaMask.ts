import {useCallback, useEffect, useMemo, useState} from 'react'

import {getMetaMask, mapChainId} from '#/lib/evmClient'
import {isWeb} from '#/platform/detection'

type Eip1193Provider = {
  request: (args: {method: string; params?: unknown[]}) => Promise<any>
  on?: (event: string, handler: (...args: any[]) => void) => void
  removeListener?: (event: string, handler: (...args: any[]) => void) => void
}

export function useMetaMask() {
  const [provider, setProvider] = useState<Eip1193Provider | null>(null)
  const [address, setAddress] = useState<string | undefined>()
  const [chainId, setChainId] = useState<string | undefined>()
  const [isConnecting, setIsConnecting] = useState(false)

  useEffect(() => {
    if (!isWeb) return
    setProvider((getMetaMask() as Eip1193Provider) || null)
  }, [])

  const refresh = useCallback(async () => {
    if (!provider) return
    const accounts = (await provider.request({
      method: 'eth_accounts',
    })) as string[]
    const nextAddress = accounts?.[0]
    const nextChainId = (await provider.request({
      method: 'eth_chainId',
    })) as string | undefined
    setAddress(nextAddress)
    setChainId(nextChainId)
  }, [provider])

  const connect = useCallback(async () => {
    if (!provider) return
    setIsConnecting(true)
    try {
      const accounts = (await provider.request({
        method: 'eth_requestAccounts',
      })) as string[]
      setAddress(accounts?.[0])
      const nextChainId = (await provider.request({
        method: 'eth_chainId',
      })) as string | undefined
      setChainId(nextChainId)
    } finally {
      setIsConnecting(false)
    }
  }, [provider])

  useEffect(() => {
    if (!provider?.on) return
    const handleAccountsChanged = (accounts: string[]) => {
      setAddress(accounts?.[0])
      void refresh()
    }
    const handleChainChanged = (nextChainId: string) => {
      setChainId(nextChainId)
      void refresh()
    }
    provider.on('accountsChanged', handleAccountsChanged)
    provider.on('chainChanged', handleChainChanged)
    return () => {
      provider.removeListener?.('accountsChanged', handleAccountsChanged)
      provider.removeListener?.('chainChanged', handleChainChanged)
    }
  }, [provider])

  useEffect(() => {
    if (!provider) return
    void refresh()
  }, [provider, refresh])

  const chainKey = useMemo(() => mapChainId(chainId), [chainId])

  return {
    provider,
    address,
    chainId,
    chainKey,
    isAvailable: Boolean(provider),
    isConnecting,
    connect,
    refresh,
  }
}
