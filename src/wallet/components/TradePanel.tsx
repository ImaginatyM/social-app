import React from 'react'
import {Modal, Pressable, Text, TextInput, View} from 'react-native'

import {EVM_NETWORKS} from '#/config/evm'
import {isMetaMaskAvailable, openPortfolio, sendTransaction} from '../metamaskBridge'
import {ReceiveModal} from './ReceiveModal'
import {SendModal} from './SendModal'

type AssetOption = {
  id: string
  symbol: string
  name: string
}

type Props = {
  assets: AssetOption[]
  address?: string
  chainId?: string
  isDesktop: boolean
}

const TABS = [
  {key: 'buy', label: 'Acheter'},
  {key: 'sell', label: 'Vendre'},
  {key: 'swap', label: 'Convertir'},
] as const

export function TradePanel({assets, address, chainId, isDesktop}: Props) {
  const [tab, setTab] = React.useState<(typeof TABS)[number]['key']>('buy')
  const [amount, setAmount] = React.useState('')
  const [selectedAsset, setSelectedAsset] = React.useState<AssetOption | null>(
    assets[0] || null,
  )
  const [showAssetPicker, setShowAssetPicker] = React.useState(false)
  const [showReceive, setShowReceive] = React.useState(false)
  const [showSend, setShowSend] = React.useState(false)
  const [sendError, setSendError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!selectedAsset && assets.length) {
      setSelectedAsset(assets[0])
    }
  }, [assets, selectedAsset])

  const onContinue = () => {
    openPortfolio(tab)
  }

  const onSend = async (to: string, valueEth: string) => {
    setSendError(null)
    if (!to) {
      setSendError('Adresse requise.')
      return
    }
    try {
      await sendTransaction({to, valueEth})
      setShowSend(false)
    } catch (err: any) {
      setSendError(err?.message || 'Envoi impossible.')
    }
  }

  const networkLabel = (() => {
    if (!chainId) return '—'
    const numeric = chainId.startsWith('0x')
      ? Number.parseInt(chainId, 16)
      : Number(chainId)
    if (numeric === EVM_NETWORKS.base.id) return 'Base'
    if (numeric === EVM_NETWORKS.ethereum.id) return 'Ethereum'
    return `Chain ${numeric}`
  })()

  return (
    <View
      className={`rounded-2xl border border-slate-800 bg-slate-900 p-5 ${
        isDesktop ? '' : 'mt-6'
      }`}>
      <View className="flex-row gap-2">
        {TABS.map(item => (
          <Pressable
            key={item.key}
            onPress={() => setTab(item.key)}
            className={`flex-1 rounded-lg px-3 py-2 ${
              tab === item.key ? 'bg-slate-800' : 'bg-transparent'
            }`}>
            <Text className="text-center text-xs font-semibold text-slate-200">
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View className="mt-4 gap-3">
        <Text className="text-xs text-slate-400">Montant</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          placeholder="0.0"
          keyboardType="decimal-pad"
          placeholderTextColor="#64748b"
          className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-100"
        />
        <Text className="text-xs text-slate-400">Asset</Text>
        <Pressable
          onPress={() => setShowAssetPicker(true)}
          className="rounded-lg border border-slate-700 px-3 py-2">
          <Text className="text-sm text-slate-100">
            {selectedAsset ? `${selectedAsset.symbol} · ${selectedAsset.name}` : 'Choisir'}
          </Text>
        </Pressable>
        <Pressable
          onPress={onContinue}
          className="mt-2 rounded-lg bg-emerald-500 px-4 py-2">
          <Text className="text-center text-xs font-semibold text-white">
            Continuer / Verifier l'ordre
          </Text>
        </Pressable>
      </View>

      <View className="mt-6 gap-2">
        <Text className="text-xs text-slate-400">Actions rapides</Text>
        <View className="flex-row flex-wrap gap-2">
          <Pressable
            onPress={() => {
              if (!isMetaMaskAvailable()) {
                setSendError('MetaMask requis pour envoyer.')
                setShowSend(true)
                return
              }
              setShowSend(true)
            }}
            className="rounded-lg border border-slate-700 px-3 py-2">
            <Text className="text-xs text-slate-200">Envoyer</Text>
          </Pressable>
          <Pressable
            onPress={() => setShowReceive(true)}
            className="rounded-lg border border-slate-700 px-3 py-2">
            <Text className="text-xs text-slate-200">Recevoir</Text>
          </Pressable>
          <Pressable
            onPress={() => openPortfolio('home')}
            className="rounded-lg border border-slate-700 px-3 py-2">
            <Text className="text-xs text-slate-200">Deposer</Text>
          </Pressable>
          <Pressable
            onPress={() => openPortfolio('home')}
            className="rounded-lg border border-slate-700 px-3 py-2">
            <Text className="text-xs text-slate-200">Retirer</Text>
          </Pressable>
        </View>
      </View>

      <Modal
        transparent
        animationType="fade"
        visible={showAssetPicker}
        onRequestClose={() => setShowAssetPicker(false)}>
        <Pressable
          onPress={() => setShowAssetPicker(false)}
          className="flex-1 items-center justify-center bg-black/60 px-4">
          <Pressable
            onPress={event => event.stopPropagation?.()}
            className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <Text className="text-sm font-semibold text-slate-100">Choisir un asset</Text>
            <View className="mt-4 gap-2">
              {assets.map(asset => (
                <Pressable
                  key={asset.id}
                  onPress={() => {
                    setSelectedAsset(asset)
                    setShowAssetPicker(false)
                  }}
                  className="rounded-lg border border-slate-800 px-3 py-2">
                  <Text className="text-sm text-slate-200">
                    {asset.symbol} · {asset.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <ReceiveModal
        open={showReceive}
        onClose={() => setShowReceive(false)}
        address={address}
        networkLabel={networkLabel}
      />
      <SendModal
        open={showSend}
        onClose={() => {
          setShowSend(false)
          setSendError(null)
        }}
        onSend={onSend}
        error={sendError}
      />
    </View>
  )
}
