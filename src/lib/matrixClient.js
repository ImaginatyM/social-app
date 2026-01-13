import * as sdk from 'matrix-js-sdk'

const BASE_URL = 'https://matrix-client.matrix.org' // provisoire, je mettrai mon propre homeserver plus tard
let currentBaseUrl = BASE_URL

let client = sdk.createClient({
  baseUrl: currentBaseUrl,
})

client.baseUrl = currentBaseUrl

export default client
export {BASE_URL}

export function normalizeMatrixBaseUrl(baseUrl) {
  if (!baseUrl) return ''
  const trimmed = String(baseUrl).trim()
  if (!trimmed) return ''
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`
  try {
    const parsed = new URL(withScheme)
    return parsed.origin
  } catch {
    return ''
  }
}

export function getMatrixBaseUrl() {
  return currentBaseUrl
}

export function setMatrixBaseUrl(baseUrl) {
  const normalized = normalizeMatrixBaseUrl(baseUrl)
  if (!normalized) return client
  if (normalized === currentBaseUrl && client) {
    client.baseUrl = currentBaseUrl
    return client
  }
  currentBaseUrl = normalized
  client = sdk.createClient({
    baseUrl: currentBaseUrl,
  })
  client.baseUrl = currentBaseUrl
  return client
}

export function hs() {
  return (
    client.baseUrl ||
    (client.clientOpts && client.clientOpts.baseUrl) ||
    (client.opts && client.opts.baseUrl) ||
    currentBaseUrl ||
    ''
  )
}

export function me() {
  if (typeof client.getUserId === 'function') return client.getUserId()
  return (client.credentials && client.credentials.userId) || ''
}

export function listJoinedRooms() {
  const rooms = client.getRooms ? client.getRooms() : []
  return rooms.filter(r => r?.getMyMembership?.() === 'join')
}

export function listDmRooms() {
  const rooms = client.getVisibleRooms ? client.getVisibleRooms() : []
  return rooms.filter(
    r => r?.isDirectMessageRoom?.() || r?.getMyMembership?.() === 'join',
  )
}

export function listIncomingInvites() {
  const rooms = client.getRooms ? client.getRooms() : []
  return rooms.filter(r => r?.getMyMembership?.() === 'invite')
}

export function listOutgoingPending() {
  const rooms = client.getVisibleRooms ? client.getVisibleRooms() : []
  return rooms.filter(r => {
    const membership = r?.getMyMembership?.()
    if (membership !== 'join') return false
    const joined = r?.getJoinedMembers?.() || []
    const invited = r?.getInvitedMembers?.() || []
    return invited.length > 0 && joined.length === 1
  })
}

export async function ensureDirectRoomWith(matrixUserId) {
  return ensureDirectRoom(matrixUserId)
}

export async function sendText(roomId, message) {
  return client.sendEvent(roomId, 'm.room.message', {
    msgtype: 'm.text',
    body: message,
  })
}

export function isMatrixLoggedIn() {
  try {
    const userId = client.getUserId && client.getUserId()
    return !!(userId && client && client.isLoggedIn)
  } catch {
    return false
  }
}

export async function loginMatrix(username, password) {
  try {
    const response = await client.login('m.login.password', {
      user: username,
      password,
    })

    const {access_token, user_id, device_id: deviceId} = response ?? {}
    if (!access_token || !user_id) {
      throw new Error('Réponse de connexion Tellus Chat invalide')
    }

    const baseUrl =
      (typeof client.getHomeserverUrl === 'function' &&
        client.getHomeserverUrl()) ||
      client.baseUrl ||
      currentBaseUrl ||
      BASE_URL
    const normalizedBaseUrl = normalizeMatrixBaseUrl(baseUrl) || BASE_URL

    currentBaseUrl = normalizedBaseUrl
    client = sdk.createClient({
      baseUrl: normalizedBaseUrl,
      accessToken: access_token,
      userId: user_id,
      deviceId,
    })

    client.startClient()

    return {access_token, user_id, device_id: deviceId}
  } catch (err) {
    console.error('Erreur de connexion Tellus Chat :', err)
    throw err
  }
}

export function loginWithToken({access_token, user_id, device_id: deviceId}) {
  if (!access_token || !user_id) {
    throw new Error('Session Tellus Chat invalide')
  }

  const baseUrl =
    (typeof client.getHomeserverUrl === 'function' &&
      client.getHomeserverUrl()) ||
    client.baseUrl ||
    currentBaseUrl ||
    BASE_URL
  const normalizedBaseUrl = normalizeMatrixBaseUrl(baseUrl) || BASE_URL

  currentBaseUrl = normalizedBaseUrl
  client = sdk.createClient({
    baseUrl: normalizedBaseUrl,
    accessToken: access_token,
    userId: user_id,
    deviceId,
  })

  client.startClient()

  return client
}

export function listInvites() {
  return listIncomingInvites()
}

export async function acceptInvite(roomId) {
  await client.joinRoom(roomId)
}

export async function rejectInvite(roomId) {
  await client.leave(roomId)
}

export async function cancelOutgoing(roomId) {
  await client.leave(roomId)
}

export async function ensureDirectRoom(matrixUserId) {
  const rooms =
    (client.getVisibleRooms && client.getVisibleRooms()) ||
    (client.getRooms && client.getRooms()) ||
    []
  for (const r of rooms) {
    if (!r) continue
    const isDM = r.isDirectMessageRoom?.()
    const joinedMembers = r.getJoinedMembers?.() || []
    const hasJoined = joinedMembers.some(
      m => m && m.userId === matrixUserId,
    )
    const members = r.getMembers?.() || []
    const hasMember = members.some(m => m && m.userId === matrixUserId)
    if (isDM && (hasJoined || hasMember)) {
      return r.roomId
    }
  }
  const res = await client.createRoom({
    is_direct: true,
    invite: [matrixUserId],
    preset: 'trusted_private_chat',
  })
  return res.room_id
}

export async function createGroupRoom({name, topic, invite}) {
  const payload = {
    is_direct: false,
    preset: 'private_chat',
    name,
  }
  if (topic) {
    payload.topic = topic
  }
  if (invite && invite.length) {
    payload.invite = invite
  }
  const res = await client.createRoom(payload)
  return res.room_id
}

export async function inviteToRoom(roomId, matrixUserId) {
  return client.invite(roomId, matrixUserId)
}

export async function leaveRoom(roomId) {
  return client.leave(roomId)
}

export function getClient() {
  return client
}

export async function logoutMatrix() {
  try {
    if (typeof client.stopClient === 'function') {
      client.stopClient();
    }
    if (typeof client.logout === 'function') {
      await client.logout();
    }
  } catch (err) {
    console.error('Erreur de déconnexion Tellus Chat :', err);
  }

  try {
    if (typeof client.clearStores === 'function') {
      await client.clearStores();
    }
  } catch (err) {
    console.warn('Impossible de nettoyer les stores Tellus Chat :', err);
  }

  client = sdk.createClient({
    baseUrl: currentBaseUrl,
  });
  client.baseUrl = currentBaseUrl;
  return client;
}
