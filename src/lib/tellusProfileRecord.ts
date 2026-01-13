import {type BskyAgent} from '@atproto/api'

import {logger} from '#/logger'
import {device} from '#/storage'

export const TELLUS_PROFILE_COLLECTION = 'app.tellus.chat.profile'
export const TELLUS_PROFILE_RKEY = 'self'

const CACHE_TTL_MS = 10 * 60 * 1000
const MAX_CACHE_ENTRIES = 200

export type TellusProfileRecord = {
  $type: typeof TELLUS_PROFILE_COLLECTION
  matrixId?: string
  updatedAt: string
}

type TellusProfile = {
  matrixId?: string
}

type CacheEntry = {
  matrixId?: string | null
  ts: number
}

type StoredCache = Record<string, CacheEntry>

const memoryCache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<TellusProfile | null>>()
let cacheLoaded = false

function isFresh(entry: CacheEntry, now = Date.now()) {
  return now - entry.ts < CACHE_TTL_MS
}

function loadCacheFromStorage() {
  if (cacheLoaded) return
  cacheLoaded = true
  const stored = device.get(['tellusProfileCache']) as StoredCache | undefined
  if (!stored || typeof stored !== 'object') return
  const now = Date.now()
  for (const [did, entry] of Object.entries(stored)) {
    if (!entry || typeof entry !== 'object') continue
    if (typeof entry.ts !== 'number') continue
    if (!isFresh(entry, now)) continue
    if (
      entry.matrixId !== undefined &&
      entry.matrixId !== null &&
      typeof entry.matrixId !== 'string'
    ) {
      continue
    }
    memoryCache.set(did, entry)
  }
}

function persistCache() {
  if (memoryCache.size === 0) {
    device.remove(['tellusProfileCache'])
    return
  }
  const now = Date.now()
  const serialized: StoredCache = {}
  for (const [did, entry] of memoryCache.entries()) {
    if (!isFresh(entry, now)) continue
    serialized[did] = {
      matrixId: entry.matrixId ?? null,
      ts: entry.ts,
    }
  }
  if (Object.keys(serialized).length === 0) {
    device.remove(['tellusProfileCache'])
    return
  }
  device.set(['tellusProfileCache'], serialized)
}

function pruneCache() {
  if (memoryCache.size <= MAX_CACHE_ENTRIES) return
  const entries = Array.from(memoryCache.entries()).sort(
    (a, b) => a[1].ts - b[1].ts,
  )
  const removeCount = entries.length - MAX_CACHE_ENTRIES
  for (let i = 0; i < removeCount; i += 1) {
    const did = entries[i]?.[0]
    if (did) memoryCache.delete(did)
  }
}

function readCache(did: string): CacheEntry | null {
  loadCacheFromStorage()
  const entry = memoryCache.get(did)
  if (!entry) return null
  if (!isFresh(entry)) {
    memoryCache.delete(did)
    persistCache()
    return null
  }
  return entry
}

function writeCache(did: string, entry: CacheEntry) {
  memoryCache.set(did, entry)
  pruneCache()
  persistCache()
}

export function validateMatrixId(
  input: string,
): {ok: true; normalized: string} | {ok: false; error: 'empty' | 'invalid'} {
  const trimmed = input.trim()
  if (!trimmed) return {ok: false, error: 'empty'}
  const normalized = trimmed.startsWith('@') ? trimmed : `@${trimmed}`
  const match = normalized.match(/^@([^:\s]+):([^:\s]+)$/)
  if (!match) return {ok: false, error: 'invalid'}
  const localpart = match[1]
  const domain = match[2].toLowerCase()
  if (!localpart || !domain) return {ok: false, error: 'invalid'}
  return {ok: true, normalized: `@${localpart}:${domain}`}
}

export async function getTellusProfile(
  did: string,
  agent?: BskyAgent,
): Promise<TellusProfile | null> {
  if (!did) return null
  const cached = readCache(did)
  if (cached) {
    return cached.matrixId ? {matrixId: cached.matrixId} : null
  }

  const existing = inflight.get(did)
  if (existing) return existing

  const request = (async () => {
    if (!agent) {
      throw new Error('Tellus profile lookup requires an agent.')
    }
    try {
      const {data} = await agent.api.com.atproto.repo.getRecord({
        repo: did,
        collection: TELLUS_PROFILE_COLLECTION,
        rkey: TELLUS_PROFILE_RKEY,
      })
      const record = data?.value as Partial<TellusProfileRecord> | undefined
      const matrixId =
        typeof record?.matrixId === 'string' ? record.matrixId.trim() : ''
      let normalizedId: string | null = null
      if (matrixId) {
        const validation = validateMatrixId(matrixId)
        if (validation.ok) {
          normalizedId = validation.normalized
        } else {
          logger.warn('tellus profile record has invalid matrixId', {
            did,
            matrixId,
          })
        }
      }
      writeCache(did, {matrixId: normalizedId, ts: Date.now()})
      return normalizedId ? {matrixId: normalizedId} : null
    } catch (e: any) {
      if (e?.message?.includes('Could not locate record')) {
        writeCache(did, {matrixId: null, ts: Date.now()})
        return null
      }
      throw e
    } finally {
      inflight.delete(did)
    }
  })()

  inflight.set(did, request)
  return request
}

export async function setTellusProfile(
  matrixId: string | null,
  agent?: BskyAgent,
): Promise<void> {
  if (!agent) {
    throw new Error('Tellus profile update requires an agent.')
  }
  const did = agent.assertDid
  if (matrixId === null) {
    try {
      await agent.api.com.atproto.repo.deleteRecord({
        repo: did,
        collection: TELLUS_PROFILE_COLLECTION,
        rkey: TELLUS_PROFILE_RKEY,
      })
    } catch (e: any) {
      if (!e?.message?.includes('Could not locate record')) {
        throw e
      }
    } finally {
      writeCache(did, {matrixId: null, ts: Date.now()})
    }
    return
  }

  const validation = validateMatrixId(matrixId)
  if (!validation.ok) {
    throw new Error('Invalid Matrix ID.')
  }

  await agent.api.com.atproto.repo.putRecord({
    repo: did,
    collection: TELLUS_PROFILE_COLLECTION,
    rkey: TELLUS_PROFILE_RKEY,
    record: {
      $type: TELLUS_PROFILE_COLLECTION,
      matrixId: validation.normalized,
      updatedAt: new Date().toISOString(),
    },
  })
  writeCache(did, {matrixId: validation.normalized, ts: Date.now()})
}
