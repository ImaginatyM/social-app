import { Platform } from 'react-native'

export type Collection = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  itemUris: string[]
  coverUri?: string
}

export const COLLECTIONS_KEY = 'saved:collections:v1'
export const MIGRATION_FLAG = 'saved:migrated:v1'

type KV = {
  get<T=any>(k:string): Promise<T|undefined>
  set<T=any>(k:string, v:T): Promise<void>
}

let kv: KV

if (Platform.OS === 'web') {
  // Web: IndexedDB via idb-keyval
  // @ts-ignore
  const { get, set } = await import('idb-keyval')
  kv = {
    get: (k) => get(k),
    set: (k, v) => set(k, v),
  }
} else {
  // Native: AsyncStorage
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default
  kv = {
    get: async (k) => {
      const s = await AsyncStorage.getItem(k)
      return s ? JSON.parse(s) : undefined
    },
    set: async (k, v) => {
      await AsyncStorage.setItem(k, JSON.stringify(v))
    },
  }
}

export async function loadCollections(): Promise<Collection[]> {
  return (await kv.get<Collection[]>(COLLECTIONS_KEY)) ?? []
}
export async function saveCollections(list: Collection[]): Promise<void> {
  await kv.set(COLLECTIONS_KEY, list)
}
export async function getMigratedFlag(): Promise<boolean> {
  return Boolean(await kv.get(MIGRATION_FLAG))
}
export async function setMigratedFlag(): Promise<void> {
  await kv.set(MIGRATION_FLAG, true)
}
