import {create} from 'zustand'
import {persist} from 'zustand/middleware'

export type Wallets = {
  evm?: {address?: string; network?: 'base' | 'ethereum'; enabled?: boolean}
  lightning?: {address?: string}
  solana?: {address?: string}
  bitcoin?: {address?: string; network?: 'mainnet' | 'testnet'}
}

type S = {
  wallets: Wallets
  setWallets: (w: Partial<Wallets>) => void
}

export const useWalletsStore = create<S>()(
  persist(
    (set, get) => ({
      wallets: {},
      setWallets: w => set({wallets: {...get().wallets, ...w}}),
    }),
    {name: 'sparker-wallets'},
  ),
)
