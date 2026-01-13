/**
 * Usage : await openMatrixDM('@alice:matrix.org', navigation, '@alice')
 */
import client, {ensureDirectRoomWith, getClient} from './matrixClient'
import {isMatrixLoggedIn} from './matrixDm'
import {validateMatrixId} from './tellusProfileRecord'

function normalizeHandle(handle: string | undefined) {
  const trimmed = (handle ?? '').trim()
  if (!trimmed) return ''
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`
}

function isMissingMatrixUser(err: any) {
  const code = err?.errcode || err?.data?.errcode
  if (typeof code === 'string') {
    return ['M_NOT_FOUND', 'M_UNKNOWN', 'M_FORBIDDEN'].includes(code)
  }
  const message = String(err?.message || '')
  return /not\s+found|unknown|no\s+such\s+user/i.test(message)
}

export default async function openMatrixDM(
  matrixId: string,
  navigation: any,
  handle?: string,
) {
  const validation = validateMatrixId(matrixId)
  if (!validation.ok) {
    throw new Error("Identifiant Tellus Chat invalide.")
  }
  const normalizedHandle = normalizeHandle(handle)
  const mxId = validation.normalized

  if (!isMatrixLoggedIn()) {
    navigation?.navigate?.('Messages')
    throw new Error(
      "Veuillez vous connecter à Tellus Chat avant d’envoyer un message.",
    )
  }

  const activeClient = getClient?.() || client
  if (typeof activeClient?.getProfileInfo === 'function') {
    try {
      await activeClient.getProfileInfo(mxId)
    } catch (err) {
      if (isMissingMatrixUser(err)) {
        navigation?.navigate?.('MessagesInvite', {
          handle: normalizedHandle,
          matrixId: mxId,
        })
        return null
      }
      throw err
    }
  }

  try {
    const roomId = await ensureDirectRoomWith(mxId)
    navigation?.navigate?.('Messages', {roomId})
    return roomId
  } catch (err) {
    if (isMissingMatrixUser(err)) {
      navigation?.navigate?.('MessagesInvite', {
        handle: normalizedHandle,
        matrixId: mxId,
      })
      return null
    }
    throw err
  }
}
