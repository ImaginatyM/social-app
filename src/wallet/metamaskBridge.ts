import {Linking} from 'react-native'
import {parseEther} from 'viem'

import {getMetaMask} from '#/lib/evmClient'
import {isWeb} from '#/platform/detection'

export type PortfolioAction = 'buy' | 'sell' | 'swap' | 'home'

const PORTFOLIO_BASE = 'https://portfolio.metamask.io/'

export const isMetaMaskAvailable = () => {
  if (!isWeb || typeof window === 'undefined') return false
  const provider = getMetaMask()
  return Boolean(provider?.isMetaMask)
}

export const openPortfolio = (action: PortfolioAction) => {
  const path =
    action === 'buy'
      ? 'buy'
      : action === 'sell'
        ? 'sell'
        : action === 'swap'
          ? 'swap'
          : ''
  const url = path ? `${PORTFOLIO_BASE}${path}` : PORTFOLIO_BASE
  if (isWeb && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener')
    return
  }
  Linking.openURL(url).catch(() => {})
}

export async function sendTransaction(params: {
  to: string
  valueEth?: string
}) {
  if (!isWeb || typeof window === 'undefined') {
    throw new Error('metamask_not_available')
  }
  const provider = getMetaMask()
  if (!provider) throw new Error('metamask_not_available')
  const requestParams: {to: string; value?: string} = {to: params.to}
  if (params.valueEth) {
    const value = parseEther(params.valueEth)
    requestParams.value = `0x${value.toString(16)}`
  }
  await provider.request({
    method: 'eth_sendTransaction',
    params: [requestParams],
  })
}
