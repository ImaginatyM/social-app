import React from 'react'
import {Modal, Pressable, Text, TextInput, View} from 'react-native'

export function SendModal({
  open,
  onClose,
  onSend,
  error,
}: {
  open: boolean
  onClose: () => void
  onSend: (to: string, amount: string) => void
  error?: string | null
}) {
  const [to, setTo] = React.useState('')
  const [amount, setAmount] = React.useState('')

  React.useEffect(() => {
    if (!open) return
    setTo('')
    setAmount('')
  }, [open])

  return (
    <Modal transparent animationType="fade" visible={open} onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        className="flex-1 items-center justify-center bg-black/60 px-4">
        <Pressable
          onPress={event => event.stopPropagation?.()}
          className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <Text className="text-lg font-semibold text-slate-100">Envoyer</Text>
          <Text className="mt-4 text-xs text-slate-400">Adresse</Text>
          <TextInput
            value={to}
            onChangeText={setTo}
            placeholder="0x..."
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            autoCorrect={false}
            className="mt-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-100"
          />
          <Text className="mt-4 text-xs text-slate-400">Montant (ETH)</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="0.01"
            keyboardType="decimal-pad"
            placeholderTextColor="#64748b"
            className="mt-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-100"
          />
          {error ? (
            <Text className="mt-3 text-xs text-red-400">{error}</Text>
          ) : null}
          <View className="mt-5 flex-row gap-3">
            <Pressable
              onPress={() => onSend(to, amount)}
              className="flex-1 rounded-lg bg-emerald-500 px-3 py-2">
              <Text className="text-center text-xs font-semibold text-white">
                Envoyer
              </Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              className="rounded-lg border border-slate-700 px-3 py-2">
              <Text className="text-xs text-slate-200">Annuler</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
