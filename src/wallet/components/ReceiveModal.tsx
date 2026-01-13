import React from 'react'
import {Modal, Pressable, Text, View} from 'react-native'
import * as Clipboard from 'expo-clipboard'

import {isWeb} from '#/platform/detection'

export function ReceiveModal({
  open,
  onClose,
  address,
  networkLabel,
}: {
  open: boolean
  onClose: () => void
  address?: string
  networkLabel?: string
}) {
  if (!open) return null

  const onCopy = async () => {
    if (!address) return
    await Clipboard.setStringAsync(address)
  }

  return (
    <Modal transparent animationType="fade" visible={open} onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        className="flex-1 items-center justify-center bg-black/60 px-4">
        <Pressable
          onPress={event => event.stopPropagation?.()}
          className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <Text className="text-lg font-semibold text-slate-100">Recevoir</Text>
          <Text className="mt-2 text-xs text-slate-400">
            {networkLabel || 'Reseau'}
          </Text>
          <Text className="mt-1 text-sm text-slate-200">
            {networkLabel || '—'}
          </Text>
          <Text className="mt-4 text-xs text-slate-400">Adresse</Text>
          <Text className="mt-1 text-sm text-slate-200">
            {address || '—'}
          </Text>
          <View className="mt-4 flex-row items-center gap-3">
            <Pressable
              onPress={onCopy}
              className="rounded-lg border border-slate-700 px-3 py-2">
              <Text className="text-xs text-slate-200">Copier</Text>
            </Pressable>
            {isWeb ? (
              <Text className="text-xs text-slate-500">Collez dans MetaMask.</Text>
            ) : null}
          </View>
          <Pressable
            onPress={onClose}
            className="mt-6 rounded-lg bg-slate-800 px-4 py-2">
            <Text className="text-xs font-semibold text-slate-200">Fermer</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
