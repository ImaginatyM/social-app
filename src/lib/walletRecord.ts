import {ComAtprotoRepoPutRecord, type BskyAgent} from '@atproto/api'
import {retry} from '@atproto/common-web'

export const WALLET_COLLECTION = 'app.spark.wallet'
export const WALLET_RKEY = 'self'

export type WalletRecord = {
  $type: 'app.spark.wallet'
  enabled: boolean
  evmAddress?: string
  evmChain?: 'base' | 'ethereum'
  updatedAt: string
}

const isWalletRecord = (value: unknown): value is WalletRecord => {
  if (!value || typeof value !== 'object') return false
  const record = value as WalletRecord
  if (record.$type && record.$type !== WALLET_COLLECTION) return false
  if (typeof record.enabled !== 'boolean') return false
  if (typeof record.updatedAt !== 'string') return false
  if (record.evmAddress && typeof record.evmAddress !== 'string') return false
  if (
    record.evmChain &&
    record.evmChain !== 'base' &&
    record.evmChain !== 'ethereum'
  ) {
    return false
  }
  return true
}

export async function getWalletRecord(
  agent: BskyAgent,
  did: string,
): Promise<WalletRecord | null> {
  try {
    const {data} = await agent.api.com.atproto.repo.getRecord({
      repo: did,
      collection: WALLET_COLLECTION,
      rkey: WALLET_RKEY,
    })
    return isWalletRecord(data.value) ? data.value : null
  } catch (e: any) {
    if (e?.message?.includes('Could not locate record')) {
      return null
    }
    throw e
  }
}

export async function upsertWalletRecord(
  agent: BskyAgent,
  did: string,
  record: WalletRecord,
) {
  const upsert = async () => {
    const existing = await agent.api.com.atproto.repo
      .getRecord({
        repo: did,
        collection: WALLET_COLLECTION,
        rkey: WALLET_RKEY,
      })
      .catch(() => null)

    await agent.api.com.atproto.repo.putRecord({
      repo: did,
      collection: WALLET_COLLECTION,
      rkey: WALLET_RKEY,
      record,
      swapRecord: existing?.data.cid || null,
    })
  }

  await retry(upsert, {
    maxRetries: 5,
    retryable: e => e instanceof ComAtprotoRepoPutRecord.InvalidSwapError,
  })
}
