import React from 'react'

import * as Layout from '#/components/Layout'
import {useMetaMask} from '#/hooks/useMetaMask'
import WalletDashboardContainer from '#/screens/WalletDashboardContainer'

export default function WalletPage() {
  const {
    provider,
    address,
    chainId,
    isAvailable,
    isConnecting,
    connect,
  } = useMetaMask()

  return (
    <Layout.Screen>
      <Layout.Content centerStyle={{maxWidth: 1280}}>
        <WalletDashboardContainer
          provider={provider}
          address={address}
          chainId={chainId}
          isAvailable={isAvailable}
          isConnecting={isConnecting}
          onConnect={connect}
        />
      </Layout.Content>
    </Layout.Screen>
  )
}
