import AsyncStorage from '@react-native-async-storage/async-storage'
import {Platform} from 'react-native'

export type MatrixConfig = {
  homeserver: string
}

export type MatrixSession = {
  accessToken: string
  userId: string
  deviceId?: string
}

const CONFIG_KEY = 'matrix:config:v1'
const SESSION_KEY = 'matrix:session:v1'
const LEGACY_SESSION_KEY = 'sparker_matrix_session'

function safeParse<T>(raw: string | null): T | undefined {
  if (!raw) return undefined
  try {
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

async function getItem<T>(key: string): Promise<T | undefined> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !window.localStorage) return undefined
    return safeParse<T>(window.localStorage.getItem(key))
  }
  const raw = await AsyncStorage.getItem(key)
  return safeParse<T>(raw)
}

async function setItem<T>(key: string, value: T): Promise<void> {
  const raw = JSON.stringify(value)
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !window.localStorage) return
    try {
      window.localStorage.setItem(key, raw)
    } catch {
      return
    }
    return
  }
  await AsyncStorage.setItem(key, raw)
}

async function removeItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !window.localStorage) return
    window.localStorage.removeItem(key)
    return
  }
  await AsyncStorage.removeItem(key)
}

function normalizeLegacySession(data: any): MatrixSession | undefined {
  if (!data || typeof data !== 'object') return undefined
  const accessToken = data.access_token ?? data.accessToken
  const userId = data.user_id ?? data.userId
  const deviceId = data.device_id ?? data.deviceId
  if (!accessToken || !userId) return undefined
  return {
    accessToken,
    userId,
    deviceId,
  }
}

export async function loadMatrixConfig(): Promise<MatrixConfig | undefined> {
  return getItem<MatrixConfig>(CONFIG_KEY)
}

export async function saveMatrixConfig(config: MatrixConfig): Promise<void> {
  await setItem(CONFIG_KEY, config)
}

export async function clearMatrixConfig(): Promise<void> {
  await removeItem(CONFIG_KEY)
}

export async function loadMatrixSession(): Promise<MatrixSession | undefined> {
  const session = await getItem<MatrixSession>(SESSION_KEY)
  if (session) return session

  if (Platform.OS !== 'web') return undefined
  if (typeof window === 'undefined' || !window.localStorage) return undefined
  const legacy = safeParse(window.localStorage.getItem(LEGACY_SESSION_KEY))
  const normalized = normalizeLegacySession(legacy)
  if (!normalized) return undefined
  await setItem(SESSION_KEY, normalized)
  return normalized
}

export async function saveMatrixSession(
  session: MatrixSession,
): Promise<void> {
  await setItem(SESSION_KEY, session)
}

export async function clearMatrixSession(): Promise<void> {
  await removeItem(SESSION_KEY)
}
