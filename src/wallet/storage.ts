import AsyncStorage from '@react-native-async-storage/async-storage'

import {isWeb} from '#/platform/detection'

const WATCHLIST_KEY = 'wallet-watchlist-v1'

const safeParse = (value: string | null) => {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export async function loadWatchlist(): Promise<string[] | null> {
  if (isWeb && typeof window !== 'undefined' && window.localStorage) {
    const stored = safeParse(window.localStorage.getItem(WATCHLIST_KEY))
    return Array.isArray(stored) ? stored : null
  }
  const raw = await AsyncStorage.getItem(WATCHLIST_KEY)
  const parsed = safeParse(raw)
  return Array.isArray(parsed) ? parsed : null
}

export async function saveWatchlist(ids: string[]) {
  const unique = Array.from(new Set(ids.filter(Boolean)))
  const raw = JSON.stringify(unique)
  if (isWeb && typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(WATCHLIST_KEY, raw)
    return
  }
  await AsyncStorage.setItem(WATCHLIST_KEY, raw)
}
