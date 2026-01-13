import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {Image, Pressable, ScrollView, StyleSheet, Switch, View} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useNavigation, useRoute} from '@react-navigation/native'

import {
  createGroupRoom,
  ensureDirectRoom,
  getMatrixBaseUrl,
  getClient,
  inviteToRoom,
  leaveRoom,
  listJoinedRooms,
  listIncomingInvites,
  listOutgoingPending,
  loginMatrix,
  loginWithToken,
  logoutMatrix,
  normalizeMatrixBaseUrl,
  sendText,
  setMatrixBaseUrl,
} from '#/lib/matrixClient'
import {validateMatrixId} from '#/lib/tellusProfileRecord'
import {
  clearMatrixSession,
  loadMatrixConfig,
  loadMatrixSession,
  saveMatrixConfig,
  saveMatrixSession,
  type MatrixSession,
} from '#/lib/storage/matrix'
import {cleanError} from '#/lib/strings/errors'
import {useWebMediaQueries} from '#/lib/hooks/useWebMediaQueries'
import {logger} from '#/logger'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as TextField from '#/components/forms/TextField'
import {ArrowLeft_Stroke2_Corner0_Rounded as ArrowLeft} from '#/components/icons/Arrow'
import {ArrowRotateCounterClockwise_Stroke2_Corner0_Rounded as RetryIcon} from '#/components/icons/ArrowRotateCounterClockwise'
import {CircleInfo_Stroke2_Corner0_Rounded as CircleInfoIcon} from '#/components/icons/CircleInfo'
import {Message_Stroke2_Corner0_Rounded as MessageIcon} from '#/components/icons/Message'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {PersonGroup_Stroke2_Corner2_Rounded as GroupIcon} from '#/components/icons/Person'
import {Text} from '#/components/Typography'
import {TimeElapsed} from '#/view/com/util/TimeElapsed'
import {Card} from '#/screens/Messages/components/Card'
import {PageShell} from '#/screens/Messages/components/PageShell'
import {StateCard} from '#/screens/Messages/components/StateCard'

type Status =
  | 'loading'
  | 'needs-login'
  | 'connecting'
  | 'ready'

type RoomMessage = {
  id: string
  sender: string
  body: string
  ts: number
  isMine: boolean
}

const DEFAULT_HOMESERVER = 'https://matrix.org'

function deriveHomeserverFromMatrixId(value: string) {
  const match = value.trim().match(/^@[^:\s]+:([^/\s]+)$/)
  if (!match) return ''
  return `https://${match[1]}`
}

function formatMatrixMessage(
  event: any,
  currentUserId: string,
): RoomMessage | null {
  const type = event?.getType?.() ?? event?.event?.type ?? event?.type
  if (type !== 'm.room.message') return null
  const content =
    event?.getContent?.() ?? event?.event?.content ?? event?.content
  if (!content || content.msgtype !== 'm.text' || !content.body) return null
  const sender = event?.getSender?.() ?? event?.event?.sender ?? ''
  const id =
    event?.getId?.() ??
    event?.event?.event_id ??
    `${sender || 'user'}-${event?.getTs?.() ?? Date.now()}`
  const ts =
    event?.getTs?.() ?? event?.event?.origin_server_ts ?? Date.now()
  return {
    id: String(id),
    sender: String(sender),
    body: String(content.body),
    ts: Number(ts) || Date.now(),
    isMine: sender === currentUserId,
  }
}

function getInitials(label: string) {
  const clean = label.trim()
  if (!clean) return ''
  const parts = clean.split(/\s+/)
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

function getOtherMember(room: any, currentUserId: string) {
  const members =
    room?.getJoinedMembers?.() || room?.getMembers?.() || []
  return members.find((member: any) => member?.userId !== currentUserId)
}

function getRoomMembers(room: any) {
  return room?.getJoinedMembers?.() || room?.getMembers?.() || []
}

function isDirectRoom(room: any) {
  if (room?.isDirectMessageRoom?.() === true) return true
  const members = getRoomMembers(room)
  const name = room?.name || room?.getName?.()
  return members.length === 2 && !name
}

function getMemberDisplayName(member: any) {
  return (
    member?.name ||
    member?.rawDisplayName ||
    member?.userId ||
    ''
  )
}

function getMemberAvatarUrl(client: any, member: any) {
  if (!client || !member) return null
  const baseUrl =
    (typeof client.getHomeserverUrl === 'function' &&
      client.getHomeserverUrl()) ||
    client.baseUrl ||
    getMatrixBaseUrl() ||
    ''
  if (!baseUrl) return null
  if (typeof member.getAvatarUrl === 'function') {
    return member.getAvatarUrl(baseUrl, 96, 96, 'crop', false, true)
  }
  const mxc = member?.avatarUrl || member?.mxcAvatarUrl
  if (mxc && typeof client.mxcUrlToHttp === 'function') {
    return client.mxcUrlToHttp(mxc, 96, 96, 'crop')
  }
  return null
}

function getRoomLastMessage(room: any, currentUserId: string) {
  const timeline = room?.getLiveTimeline?.()
  const events =
    timeline?.getEvents?.() ?? room?.timeline ?? []
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const parsed = formatMatrixMessage(events[i], currentUserId)
    if (parsed) return parsed
  }
  return null
}

function getUnreadCount(room: any) {
  const count =
    room?.getUnreadNotificationCount?.('total') ??
    room?.getUnreadNotificationCount?.() ??
    room?.unreadNotificationCount
  return typeof count === 'number' ? count : null
}

export function MessagesScreen() {
  const {_} = useLingui()
  const t = useTheme()
  const {isMobile} = useWebMediaQueries()
  const navigation = useNavigation<any>()
  const route = useRoute<any>()
  const [status, setStatus] = useState<Status>('loading')
  const [session, setSession] = useState<MatrixSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)

  const [homeserverInput, setHomeserverInput] = useState(DEFAULT_HOMESERVER)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [stayLoggedIn, setStayLoggedIn] = useState(true)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [hasCustomHomeserver, setHasCustomHomeserver] = useState(false)

  const [rooms, setRooms] = useState<any[]>([])
  const [incomingCount, setIncomingCount] = useState(0)
  const [outgoingCount, setOutgoingCount] = useState(0)

  const [newConversationOpen, setNewConversationOpen] = useState(false)
  const [newConversationUser, setNewConversationUser] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [newGroupOpen, setNewGroupOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDescription, setNewGroupDescription] = useState('')
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null)
  const [groupPanelOpen, setGroupPanelOpen] = useState(false)
  const [inviteInput, setInviteInput] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [isInviting, setIsInviting] = useState(false)
  const [leaveError, setLeaveError] = useState<string | null>(null)
  const [roomMessages, setRoomMessages] = useState<RoomMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesError, setMessagesError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [messageInput, setMessageInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list')
  const latestRoomId = useRef<string | null>(null)
  const messageListRef = useRef<ScrollView | null>(null)

  const resolvedHomeserver = useMemo(() => {
    return normalizeMatrixBaseUrl(homeserverInput) || DEFAULT_HOMESERVER
  }, [homeserverInput])
  const hasSession = Boolean(session?.accessToken && session?.userId)
  const isReady = status === 'ready'
  const isConnecting = status === 'connecting'
  const matrixClient = getClient()
  const currentUserId =
    session?.userId || matrixClient?.getUserId?.() || ''

  const refreshRooms = useCallback(() => {
    try {
      setRooms([...listJoinedRooms()])
      setIncomingCount(listIncomingInvites().length)
      setOutgoingCount(listOutgoingPending().length)
    } catch (err) {
      logger.error('Tellus Chat refresh failed', {message: err})
    }
  }, [])

  const connectWithSession = useCallback(async () => {
    if (!session?.accessToken || !session?.userId) return
    setError(null)
    try {
      setMatrixBaseUrl(resolvedHomeserver)
      await loginWithToken({
        access_token: session.accessToken,
        user_id: session.userId,
        device_id: session.deviceId,
      })
      await saveMatrixConfig({homeserver: resolvedHomeserver})
      setStatus('ready')
      refreshRooms()
    } catch (err) {
      const message =
        cleanError(err) || _(msg`Impossible de se connecter à Tellus Chat.`)
      setError(message)
      setStatus('needs-login')
    }
  }, [resolvedHomeserver, session, refreshRooms, _])

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const [savedConfig, savedSession] = await Promise.all([
          loadMatrixConfig(),
          loadMatrixSession(),
        ])
        if (!active) return
        const normalizedHomeserver = savedConfig?.homeserver
          ? normalizeMatrixBaseUrl(savedConfig.homeserver)
          : ''
        const derivedFromSession =
          !normalizedHomeserver && savedSession?.userId
            ? deriveHomeserverFromMatrixId(savedSession.userId)
            : ''
        const initialHomeserver =
          normalizedHomeserver || derivedFromSession || DEFAULT_HOMESERVER
        setSession(savedSession ?? null)
        setHomeserverInput(initialHomeserver)
        setMatrixBaseUrl(initialHomeserver)
        setHasCustomHomeserver(
          Boolean(normalizedHomeserver && normalizedHomeserver !== DEFAULT_HOMESERVER),
        )
        if (savedSession?.accessToken && savedSession?.userId) {
          setStatus('connecting')
        } else {
          setStatus('needs-login')
        }
      } catch (err) {
        logger.error('Tellus Chat storage load failed', {message: err})
        if (!active) return
        setStatus('needs-login')
      }
    }

    load()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (status !== 'connecting') return
    connectWithSession()
  }, [status, connectWithSession])

  useEffect(() => {
    if (status !== 'ready') return
    const client = getClient()
    const onSync = (state: string) => {
      if (state === 'PREPARED') {
        refreshRooms()
      }
    }
    client?.on?.('sync', onSync)
    return () => client?.removeListener?.('sync', onSync)
  }, [status, refreshRooms])

  const onLogin = useCallback(async () => {
    const trimmedUser = username.trim()
    if (!trimmedUser || !password) return
    const normalizedHomeserver = normalizeMatrixBaseUrl(homeserverInput)
    if (!normalizedHomeserver) {
      setConfigError(_(msg`Serveur invalide.`))
      setAdvancedOpen(true)
      return
    }
    setConfigError(null)
    setStatus('connecting')
    setError(null)
    try {
      setMatrixBaseUrl(normalizedHomeserver)
      const response = await loginMatrix(trimmedUser, password)
      const nextSession = {
        accessToken: response.access_token,
        userId: response.user_id,
        deviceId: response.device_id,
      }
      setSession(nextSession)
      await saveMatrixConfig({homeserver: normalizedHomeserver})
      if (stayLoggedIn) {
        await saveMatrixSession(nextSession)
      } else {
        await clearMatrixSession()
      }
      setPassword('')
      setStatus('ready')
      refreshRooms()
    } catch (err) {
      const message =
        cleanError(err) || _(msg`Échec de la connexion Tellus Chat.`)
      setError(message)
      setStatus('needs-login')
    }
  }, [
    username,
    password,
    homeserverInput,
    stayLoggedIn,
    refreshRooms,
    _,
  ])

  const onLogout = useCallback(async () => {
    await logoutMatrix()
    await clearMatrixSession()
    setSession(null)
    setError(null)
    setRooms([])
    setIncomingCount(0)
    setOutgoingCount(0)
    setNewConversationOpen(false)
    setNewConversationUser('')
    setNewGroupOpen(false)
    setNewGroupName('')
    setNewGroupDescription('')
    setSelectedRoomId(null)
    setGroupPanelOpen(false)
    setInviteInput('')
    setInviteError(null)
    setIsInviting(false)
    setLeaveError(null)
    setRoomMessages([])
    setMessagesError(null)
    setSendError(null)
    setMessageInput('')
    setMobileView('list')
    setStatus('needs-login')
  }, [])

  const onRetry = useCallback(() => {
    setError(null)
    if (session?.accessToken && session?.userId) {
      setStatus('connecting')
    } else {
      setStatus('needs-login')
    }
  }, [session])

  const onCreateConversation = useCallback(async () => {
    if (status !== 'ready') return
    const value = newConversationUser.trim()
    if (!value || isCreating) return
    setIsCreating(true)
    try {
      await ensureDirectRoom(value)
      setNewConversationUser('')
      setNewConversationOpen(false)
      setNewGroupOpen(false)
      refreshRooms()
    } catch (err) {
      const message =
        cleanError(err) || _(msg`Impossible de créer la conversation.`)
      setError(message)
    } finally {
      setIsCreating(false)
    }
  }, [status, newConversationUser, isCreating, refreshRooms, _])

  const conversationLabel = useMemo(
    () => _(msg`Conversation`),
    [_],
  )
  const groupLabel = useMemo(() => _(msg`Groupe`), [_])

  const roomSummaries = useMemo(() => {
    const summaries = rooms.map(room => {
      const roomId = room?.roomId ?? null
      const isDirect = isDirectRoom(room)
      const members = getRoomMembers(room)
      const member = isDirect ? getOtherMember(room, currentUserId) : null
      const displayName = isDirect
        ? getMemberDisplayName(member) ||
          room?.name ||
          room?.getName?.() ||
          conversationLabel
        : room?.name || room?.getName?.() || groupLabel
      const avatarUrl = isDirect
        ? getMemberAvatarUrl(matrixClient, member)
        : null
      const lastMessage = getRoomLastMessage(room, currentUserId)
      const lastMessagePreview = lastMessage
        ? lastMessage.isMine
          ? _(msg`Vous: ${lastMessage.body}`)
          : lastMessage.body
        : _(msg`Aucun message`)
      const rawLastMessageTs =
        lastMessage?.ts ?? room?.getLastActiveTimestamp?.() ?? null
      const lastMessageTs =
        typeof rawLastMessageTs === 'number' && rawLastMessageTs > 0
          ? rawLastMessageTs
          : null
      const unreadCount = getUnreadCount(room)
      return {
        room,
        roomId,
        displayName,
        avatarUrl,
        initials: getInitials(displayName),
        isGroup: !isDirect,
        lastMessagePreview,
        lastMessageTs,
        unreadCount,
      }
    })
    return summaries.sort(
      (a, b) => (b.lastMessageTs ?? 0) - (a.lastMessageTs ?? 0),
    )
  }, [rooms, currentUserId, conversationLabel, groupLabel, matrixClient, _])

  const roomSummaryById = useMemo(() => {
    const map = new Map<string, (typeof roomSummaries)[number]>()
    roomSummaries.forEach(summary => {
      if (summary.roomId) {
        map.set(summary.roomId, summary)
      }
    })
    return map
  }, [roomSummaries])

  const onMatrixIdChange = useCallback(
    (value: string) => {
      setUsername(value)
      if (hasCustomHomeserver) return
      const derived = deriveHomeserverFromMatrixId(value)
      if (derived) {
        setHomeserverInput(derived)
        setConfigError(null)
      }
    },
    [hasCustomHomeserver],
  )

  const onHomeserverChange = useCallback((value: string) => {
    setHomeserverInput(value)
    setHasCustomHomeserver(true)
    setConfigError(null)
  }, [])

  const roomIdFromParams = (route?.params as any)?.roomId as
    | string
    | undefined

  const getRoomIdFromQuery = useCallback(() => {
    if (typeof window === 'undefined') return null
    const params = new URLSearchParams(window.location.search)
    return params.get('room')
  }, [])

  const updateRoomQuery = useCallback(
    (roomId: string | null, replace?: boolean) => {
      if (typeof window === 'undefined') return
      const url = new URL(window.location.href)
      const current = url.searchParams.get('room')
      if (roomId) {
        if (current === roomId) return
        url.searchParams.set('room', roomId)
      } else {
        if (!current) return
        url.searchParams.delete('room')
      }
      if (replace) {
        window.history.replaceState({}, '', url.toString())
      } else {
        window.history.pushState({}, '', url.toString())
      }
    },
    [],
  )

  const openNewGroup = useCallback(() => {
    setNewGroupOpen(true)
    setNewConversationOpen(false)
    if (isMobile) setMobileView('list')
  }, [isMobile])

  const onCreateGroup = useCallback(async () => {
    if (status !== 'ready') return
    const name = newGroupName.trim()
    if (!name || isCreatingGroup) return
    setIsCreatingGroup(true)
    setError(null)
    try {
      const topic = newGroupDescription.trim()
      const roomId = await createGroupRoom({
        name,
        topic: topic || undefined,
      })
      setNewGroupName('')
      setNewGroupDescription('')
      setNewGroupOpen(false)
      refreshRooms()
      if (roomId) {
        setSelectedRoomId(roomId)
        setGroupPanelOpen(true)
        setInviteInput('')
        setInviteError(null)
        setLeaveError(null)
        setMobileView('thread')
        updateRoomQuery(roomId)
      }
    } catch (err) {
      const message = cleanError(err) || _(msg`Impossible de créer le groupe.`)
      setError(message)
    } finally {
      setIsCreatingGroup(false)
    }
  }, [
    status,
    newGroupName,
    newGroupDescription,
    isCreatingGroup,
    refreshRooms,
    updateRoomQuery,
    _,
  ])

  const onBackToList = useCallback(() => {
    setSelectedRoomId(null)
    setRoomMessages([])
    setMessagesError(null)
    setSendError(null)
    setMessageInput('')
    setGroupPanelOpen(false)
    setInviteInput('')
    setInviteError(null)
    setLeaveError(null)
    setMobileView('list')
    updateRoomQuery(null, true)
  }, [updateRoomQuery])

  const openNewConversation = useCallback(() => {
    setNewConversationOpen(true)
    setNewGroupOpen(false)
    if (isMobile) setMobileView('list')
  }, [isMobile])

  const selectRoom = useCallback(
    (room: any) => {
      const roomId = room?.roomId
      if (!roomId) return
      setSelectedRoomId(roomId)
      setRoomMessages([])
      setMessagesError(null)
      setSendError(null)
      setMessageInput('')
      setGroupPanelOpen(false)
      setInviteInput('')
      setInviteError(null)
      setLeaveError(null)
      setMobileView('thread')
      updateRoomQuery(roomId)
    },
    [updateRoomQuery],
  )

  const loadRoomMessages = useCallback(
    async (roomId: string) => {
      if (!roomId) return
      const client = getClient()
      if (!client?.getRoom) {
        setMessagesError(_(msg`Tellus Chat indisponible.`))
        return
      }
      setMessagesLoading(true)
      setMessagesError(null)
      try {
        const room = client.getRoom(roomId)
        if (!room) {
          throw new Error('Conversation introuvable')
        }
        const timeline = room.getLiveTimeline?.()
        const unfilteredTimeline = room.getUnfilteredTimeline?.()
        const events =
          timeline?.getEvents?.() ??
          unfilteredTimeline?.getEvents?.() ??
          room.timeline ??
          []
        const currentUserId = session?.userId || client.getUserId?.() || ''
        const parsed = events
          .map((event: any) => formatMatrixMessage(event, currentUserId))
          .filter(Boolean) as RoomMessage[]
        parsed.sort((a, b) => a.ts - b.ts)
        if (latestRoomId.current !== roomId) return
        setRoomMessages(parsed)
      } catch (err) {
        if (latestRoomId.current !== roomId) return
        const message =
          cleanError(err) || _(msg`Impossible de charger les messages.`)
        setMessagesError(message)
      } finally {
        if (latestRoomId.current === roomId) {
          setMessagesLoading(false)
        }
      }
    },
    [session?.userId, _],
  )

  const onRetryMessages = useCallback(() => {
    if (!selectedRoomId) return
    loadRoomMessages(selectedRoomId)
  }, [selectedRoomId, loadRoomMessages])

  const scrollToBottom = useCallback((animated: boolean) => {
    requestAnimationFrame(() => {
      messageListRef.current?.scrollToEnd({animated})
    })
  }, [])

  const onSendMessage = useCallback(async () => {
    if (!selectedRoomId || !messageInput.trim() || isSending) return
    const body = messageInput.trim()
    setIsSending(true)
    setSendError(null)
    setMessageInput('')
    try {
      const response = await sendText(selectedRoomId, body)
      const eventId = response?.event_id || response?.eventId
      const client = getClient()
      const currentUserId = session?.userId || client.getUserId?.() || ''
      const optimistic: RoomMessage = {
        id: String(eventId || `local-${Date.now()}`),
        sender: currentUserId,
        body,
        ts: Date.now(),
        isMine: true,
      }
      setRoomMessages(prev => {
        if (prev.some(message => message.id === optimistic.id)) return prev
        return [...prev, optimistic]
      })
      scrollToBottom(true)
    } catch (err) {
      const message =
        cleanError(err) || _(msg`Impossible d'envoyer le message.`)
      setSendError(message)
      setMessageInput(body)
    } finally {
      setIsSending(false)
    }
  }, [
    selectedRoomId,
    messageInput,
    isSending,
    session?.userId,
    scrollToBottom,
    _,
  ])

  const headerAction = (
    <View style={[a.flex_row, a.flex_wrap, a.align_center, a.gap_sm]}>
      <Button
        label={_(msg`Nouvelle discussion`)}
        color="primary"
        size="small"
        variant="solid"
        disabled={!isReady}
        onPress={openNewConversation}>
        <ButtonIcon icon={PlusIcon} position="left" />
        <ButtonText>
          <Trans>Nouvelle discussion</Trans>
        </ButtonText>
      </Button>
      <Button
        label={_(msg`Nouveau groupe`)}
        color="secondary"
        size="small"
        variant="solid"
        disabled={!isReady}
        onPress={openNewGroup}>
        <ButtonIcon icon={GroupIcon} position="left" />
        <ButtonText>
          <Trans>Nouveau groupe</Trans>
        </ButtonText>
      </Button>
      {hasSession ? (
        <Button
          label={_(msg`Se déconnecter`)}
          color="secondary"
          size="small"
          variant="outline"
          onPress={onLogout}>
          <ButtonText>
            <Trans>Se déconnecter</Trans>
          </ButtonText>
        </Button>
      ) : null}
    </View>
  )

  const showLoginForm = !isReady && status !== 'loading'
  const loginDisabled = isConnecting || !username.trim() || !password
  const showNewConversation = isReady && newConversationOpen
  const showNewGroup = isReady && newGroupOpen
  const showList = !isMobile || mobileView === 'list'
  const showThread = !isMobile || mobileView === 'thread'
  const roomsById = useMemo(() => {
    const map = new Map<string, any>()
    rooms.forEach(room => {
      const roomId = room?.roomId
      if (roomId) map.set(roomId, room)
    })
    return map
  }, [rooms])
  const selectedRoom = selectedRoomId ? roomsById.get(selectedRoomId) : null
  const selectedRoomSummary = selectedRoomId
    ? roomSummaryById.get(selectedRoomId)
    : null
  const selectedRoomIsGroup = selectedRoom
    ? !isDirectRoom(selectedRoom)
    : false
  const selectedRoomMembers = useMemo(() => {
    if (!selectedRoom) return []
    return getRoomMembers(selectedRoom)
  }, [selectedRoom])
  const selectedRoomTitle =
    selectedRoomSummary?.displayName ||
    selectedRoom?.name ||
    selectedRoom?.getName?.() ||
    conversationLabel
  const selectedRoomAvatarUrl = selectedRoomSummary?.avatarUrl || null
  const selectedRoomInitials = getInitials(selectedRoomTitle)
  const showSummary = incomingCount > 0 || outgoingCount > 0
  const canSend =
    Boolean(selectedRoomId && messageInput.trim()) && !isSending && isReady
  const toggleGroupPanel = useCallback(() => {
    setGroupPanelOpen(open => !open)
    setInviteError(null)
    setLeaveError(null)
  }, [])

  const onInviteToGroup = useCallback(async () => {
    if (!selectedRoomId || !selectedRoomIsGroup) return
    const value = inviteInput.trim()
    if (!value || isInviting) return
    const validation = validateMatrixId(value)
    if (!validation.ok) {
      setInviteError(_(msg`Identifiant Tellus Chat invalide.`))
      return
    }
    setInviteError(null)
    setIsInviting(true)
    try {
      await inviteToRoom(selectedRoomId, validation.normalized)
      setInviteInput('')
      refreshRooms()
    } catch (err) {
      const message =
        cleanError(err) || _(msg`Impossible d’inviter cette personne.`)
      setInviteError(message)
    } finally {
      setIsInviting(false)
    }
  }, [
    selectedRoomId,
    selectedRoomIsGroup,
    inviteInput,
    isInviting,
    refreshRooms,
    _,
  ])

  const onLeaveGroup = useCallback(async () => {
    if (!selectedRoomId || !selectedRoomIsGroup) return
    setLeaveError(null)
    try {
      await leaveRoom(selectedRoomId)
      refreshRooms()
      onBackToList()
    } catch (err) {
      const message =
        cleanError(err) || _(msg`Impossible de quitter le groupe.`)
      setLeaveError(message)
    }
  }, [selectedRoomId, selectedRoomIsGroup, refreshRooms, onBackToList, _])

  useEffect(() => {
    if (!isReady || !roomIdFromParams) return
    if (roomIdFromParams === selectedRoomId) return
    setSelectedRoomId(roomIdFromParams)
    setGroupPanelOpen(false)
    setInviteInput('')
    setInviteError(null)
    setLeaveError(null)
    setMobileView('thread')
    updateRoomQuery(roomIdFromParams, true)
    navigation?.setParams?.({roomId: undefined})
  }, [
    isReady,
    roomIdFromParams,
    selectedRoomId,
    updateRoomQuery,
    navigation,
  ])

  useEffect(() => {
    latestRoomId.current = selectedRoomId
    if (!selectedRoomId || status !== 'ready') {
      setMessagesLoading(false)
      setMessagesError(null)
      return
    }
    loadRoomMessages(selectedRoomId)
  }, [selectedRoomId, status, loadRoomMessages])

  useEffect(() => {
    if (!selectedRoomId || messagesLoading || roomMessages.length === 0) return
    scrollToBottom(false)
  }, [selectedRoomId, messagesLoading, roomMessages.length, scrollToBottom])

  useEffect(() => {
    if (!isReady || typeof window === 'undefined') return
    const roomId = getRoomIdFromQuery()
    if (roomId && !selectedRoomId) {
      setSelectedRoomId(roomId)
      setGroupPanelOpen(false)
      setInviteInput('')
      setInviteError(null)
      setLeaveError(null)
      setMobileView('thread')
    }
  }, [isReady, selectedRoomId, getRoomIdFromQuery])

  useEffect(() => {
    if (!isReady || typeof window === 'undefined') return
    const onPopState = () => {
      const roomId = getRoomIdFromQuery()
      if (!roomId) {
        setSelectedRoomId(null)
        setRoomMessages([])
        setMessagesError(null)
        setSendError(null)
        setGroupPanelOpen(false)
        setInviteInput('')
        setInviteError(null)
        setLeaveError(null)
        setMobileView('list')
        return
      }
      setSelectedRoomId(roomId)
      setGroupPanelOpen(false)
      setInviteInput('')
      setInviteError(null)
      setLeaveError(null)
      setMobileView('thread')
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [isReady, getRoomIdFromQuery])

  useEffect(() => {
    if (!isReady || !selectedRoomId) return
    const client = getClient()
    if (!client?.on) return
    const onTimeline = (event: any, room: any) => {
      const roomId =
        room?.roomId || event?.getRoomId?.() || event?.event?.room_id
      if (!roomId || roomId !== selectedRoomId) return
      const currentUserId = session?.userId || client.getUserId?.() || ''
      const parsed = formatMatrixMessage(event, currentUserId)
      if (!parsed) return
      setRoomMessages(prev => {
        if (prev.some(message => message.id === parsed.id)) return prev
        if (!prev.length || parsed.ts >= prev[prev.length - 1].ts) {
          return [...prev, parsed]
        }
        return [...prev, parsed].sort((a, b) => a.ts - b.ts)
      })
      refreshRooms()
    }
    client.on('Room.timeline', onTimeline)
    return () => client.removeListener?.('Room.timeline', onTimeline)
  }, [isReady, selectedRoomId, session?.userId, refreshRooms])

  return (
    <PageShell title={_(msg`Tellus Chat`)} action={headerAction}>
      {!isReady ? (
        <ScrollView contentContainerStyle={[a.gap_lg, styles.contentContainer]}>
          <View style={[styles.column, a.gap_lg]}>
            {error ? (
              <StateCard
                title={_(msg`Tellus Chat indisponible`)}
                description={error}
                icon={CircleInfoIcon}
                tone="error"
                action={
                  <Button
                    label={_(msg`Réessayer`)}
                    color="secondary"
                    size="small"
                    variant="solid"
                    onPress={onRetry}>
                    <ButtonText>
                      <Trans>Réessayer</Trans>
                    </ButtonText>
                    <ButtonIcon icon={RetryIcon} position="right" />
                  </Button>
                }
              />
            ) : null}

            {status === 'loading' ? (
              <StateCard
                title={_(msg`Chargement des messages`)}
                description={_(msg`Connexion à Tellus Chat en cours...`)}
                icon={CircleInfoIcon}
              />
            ) : null}

            {showLoginForm ? (
              <Card style={[styles.cardNarrow]}>
                <View style={[a.gap_md]}>
                  <Text style={[a.text_lg, a.font_bold]}>
                    <Trans>Se connecter à Tellus Chat</Trans>
                  </Text>
                  <View style={[a.gap_md]}>
                    <View>
                      <TextField.LabelText>
                        <Trans>Identifiant Tellus Chat</Trans>
                      </TextField.LabelText>
                      <TextField.Root>
                        <TextField.Input
                          label={_(msg`@alice:tellus.chat`)}
                          value={username}
                          onChangeText={onMatrixIdChange}
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                      </TextField.Root>
                    </View>
                    <View>
                      <TextField.LabelText>
                        <Trans>Mot de passe</Trans>
                      </TextField.LabelText>
                      <TextField.Root>
                        <TextField.Input
                          label={_(msg`Mot de passe`)}
                          value={password}
                          onChangeText={setPassword}
                          secureTextEntry
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                      </TextField.Root>
                    </View>
                  </View>
                  <View style={[a.flex_row, a.align_center, a.justify_between]}>
                    <View style={[a.flex_row, a.align_center, a.gap_sm]}>
                      <Switch
                        value={stayLoggedIn}
                        onValueChange={setStayLoggedIn}
                      />
                      <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                        <Trans>Rester connecté</Trans>
                      </Text>
                    </View>
                    <Button
                      label={_(msg`Se connecter`)}
                      color="primary"
                      size="small"
                      variant="solid"
                      disabled={loginDisabled}
                      onPress={onLogin}>
                      <ButtonText>
                        <Trans>Se connecter</Trans>
                      </ButtonText>
                    </Button>
                  </View>

                  <View style={[a.gap_sm]}>
                    <Button
                      label={_(msg`À propos / avancé`)}
                      color="secondary"
                      size="small"
                      variant="ghost"
                      onPress={() => setAdvancedOpen(open => !open)}>
                      <ButtonText>
                        <Trans>À propos / avancé</Trans>
                      </ButtonText>
                    </Button>

                    {advancedOpen ? (
                      <View style={[a.gap_sm]}>
                        <View style={[a.gap_2xs]}>
                          <Text style={[a.text_sm, a.font_bold]}>
                            <Trans>À propos</Trans>
                          </Text>
                          <Text
                            style={[
                              a.text_sm,
                              t.atoms.text_contrast_medium,
                            ]}>
                            <Trans>Tellus Chat est basé sur Matrix.</Trans>
                          </Text>
                          <Text
                            style={[
                              a.text_sm,
                              t.atoms.text_contrast_medium,
                            ]}>
                            <Trans>
                              Connecte ton compte Tellus Chat (propulsé par
                              Matrix).
                            </Trans>
                          </Text>
                        </View>
                        <View>
                          <TextField.LabelText>
                            <Trans>Serveur</Trans>
                          </TextField.LabelText>
                          <TextField.Root>
                            <TextField.Input
                              label={_(msg`https://matrix.org`)}
                              value={homeserverInput}
                              onChangeText={onHomeserverChange}
                              autoCapitalize="none"
                              autoCorrect={false}
                            />
                          </TextField.Root>
                          <Text
                            style={[
                              a.text_sm,
                              t.atoms.text_contrast_medium,
                            ]}>
                            <Trans>
                              Change seulement si tu utilises un autre serveur.
                            </Trans>
                          </Text>
                          {configError ? (
                            <Text
                              style={[
                                a.text_sm,
                                styles.errorText,
                                {color: t.palette.negative_500},
                              ]}>
                              {configError}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Card>
            ) : null}

            {status === 'connecting' ? (
              <StateCard
                title={_(msg`Connexion à Tellus Chat`)}
                description={_(msg`Synchronisation des conversations...`)}
                icon={CircleInfoIcon}
              />
            ) : null}
          </View>
        </ScrollView>
      ) : (
        <View style={[styles.readyContainer, a.gap_lg]}>
          {error ? (
            <StateCard
              title={_(msg`Tellus Chat indisponible`)}
              description={error}
              icon={CircleInfoIcon}
              tone="error"
              action={
                <Button
                  label={_(msg`Réessayer`)}
                  color="secondary"
                  size="small"
                  variant="solid"
                  onPress={onRetry}>
                  <ButtonText>
                    <Trans>Réessayer</Trans>
                  </ButtonText>
                  <ButtonIcon icon={RetryIcon} position="right" />
                </Button>
              }
            />
          ) : null}

          <View style={[styles.chatLayout, a.gap_lg]}>
            {showList ? (
              <View style={[styles.listColumn, isMobile && styles.listColumnMobile]}>
                {showNewConversation ? (
                  <Card>
                    <View style={[a.gap_md]}>
                      <Text style={[a.text_lg, a.font_bold]}>
                        <Trans>Nouvelle discussion</Trans>
                      </Text>
                      <View>
                        <TextField.LabelText>
                          <Trans>Identifiant Tellus Chat</Trans>
                        </TextField.LabelText>
                        <TextField.Root>
                          <TextField.Input
                            label={_(msg`@utilisateur:tellus.chat`)}
                            value={newConversationUser}
                            onChangeText={setNewConversationUser}
                            autoCapitalize="none"
                            autoCorrect={false}
                          />
                        </TextField.Root>
                      </View>
                      <View style={[a.flex_row, a.justify_between]}>
                        <Button
                          label={_(msg`Annuler`)}
                          color="secondary"
                          size="small"
                          variant="outline"
                          onPress={() => setNewConversationOpen(false)}>
                          <ButtonText>
                            <Trans>Annuler</Trans>
                          </ButtonText>
                        </Button>
                        <Button
                          label={_(msg`Créer`)}
                          color="primary"
                          size="small"
                          variant="solid"
                          disabled={!newConversationUser.trim() || isCreating}
                          onPress={onCreateConversation}>
                          <ButtonText>
                            <Trans>Créer</Trans>
                          </ButtonText>
                        </Button>
                      </View>
                    </View>
                  </Card>
                ) : null}
                {showNewGroup ? (
                  <Card>
                    <View style={[a.gap_md]}>
                      <Text style={[a.text_lg, a.font_bold]}>
                        <Trans>Nouveau groupe</Trans>
                      </Text>
                      <View style={[a.gap_md]}>
                        <View>
                          <TextField.LabelText>
                            <Trans>Nom du groupe</Trans>
                          </TextField.LabelText>
                          <TextField.Root>
                            <TextField.Input
                              label={_(msg`Mon groupe`)}
                              value={newGroupName}
                              onChangeText={setNewGroupName}
                              autoCapitalize="sentences"
                              autoCorrect={false}
                            />
                          </TextField.Root>
                        </View>
                        <View>
                          <TextField.LabelText>
                            <Trans>Description (optionnelle)</Trans>
                          </TextField.LabelText>
                          <TextField.Root>
                            <TextField.Input
                              label={_(msg`De quoi parle ce groupe ?`)}
                              value={newGroupDescription}
                              onChangeText={setNewGroupDescription}
                              autoCapitalize="sentences"
                              autoCorrect={false}
                            />
                          </TextField.Root>
                        </View>
                      </View>
                      <View style={[a.flex_row, a.justify_between]}>
                        <Button
                          label={_(msg`Annuler`)}
                          color="secondary"
                          size="small"
                          variant="outline"
                          onPress={() => setNewGroupOpen(false)}>
                          <ButtonText>
                            <Trans>Annuler</Trans>
                          </ButtonText>
                        </Button>
                        <Button
                          label={_(msg`Créer`)}
                          color="primary"
                          size="small"
                          variant="solid"
                          disabled={!newGroupName.trim() || isCreatingGroup}
                          onPress={onCreateGroup}>
                          <ButtonText>
                            <Trans>Créer</Trans>
                          </ButtonText>
                        </Button>
                      </View>
                    </View>
                  </Card>
                ) : null}

                {showSummary ? (
                  <View style={[a.flex_row, a.flex_wrap, a.gap_md]}>
                    <Card style={[a.flex_1]}>
                      <View style={[a.gap_xs]}>
                        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                          <Trans>Invitations</Trans>
                        </Text>
                        <Text style={[a.text_lg, a.font_bold]}>
                          {incomingCount}
                        </Text>
                      </View>
                    </Card>
                    <Card style={[a.flex_1]}>
                      <View style={[a.gap_xs]}>
                        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                          <Trans>En attente</Trans>
                        </Text>
                        <Text style={[a.text_lg, a.font_bold]}>
                          {outgoingCount}
                        </Text>
                      </View>
                    </Card>
                  </View>
                ) : null}

                {roomSummaries.length === 0 ? (
                  <StateCard
                    title={_(msg`Aucune discussion`)}
                    description={_(msg`Lance une discussion ou crée un groupe.`)}
                    icon={MessageIcon}
                    tone="empty"
                    action={
                      <Button
                        label={_(msg`Nouvelle discussion`)}
                        color="primary"
                        size="small"
                        variant="solid"
                        onPress={openNewConversation}>
                        <ButtonIcon icon={PlusIcon} position="left" />
                        <ButtonText>
                          <Trans>Nouvelle discussion</Trans>
                        </ButtonText>
                      </Button>
                    }
                  />
                ) : (
                  <ScrollView
                    style={[styles.listScroll]}
                    contentContainerStyle={[a.gap_sm, styles.listScrollContent]}>
                    {roomSummaries.map((summary, index) => {
                      const {
                        room,
                        roomId,
                        displayName,
                        avatarUrl,
                        initials,
                        isGroup,
                        lastMessagePreview,
                        lastMessageTs,
                        unreadCount,
                      } = summary
                      const isSelected =
                        Boolean(roomId) && roomId === selectedRoomId
                      const showUnreadBadge =
                        typeof unreadCount === 'number' && unreadCount > 0
                      const showUnreadPlaceholder = unreadCount === null
                      return (
                        <Pressable
                          key={roomId || `${displayName}-${index}`}
                          accessibilityRole="button"
                          accessibilityLabel={displayName}
                          onPress={() => selectRoom(room)}
                          style={({pressed}) => [
                            styles.roomButton,
                            a.p_md,
                            a.rounded_md,
                            a.border,
                            t.atoms.border_contrast_low,
                            t.atoms.bg_contrast_25,
                            pressed && t.atoms.bg_contrast_50,
                            isSelected && styles.roomButtonSelected,
                            isSelected && {
                              borderColor: t.palette.primary_500,
                              backgroundColor: t.palette.primary_50,
                            },
                          ]}>
                          <View style={[a.flex_row, a.align_center, a.gap_md]}>
                            <View
                              style={[
                                styles.avatar,
                                t.atoms.bg_contrast_50,
                              ]}>
                              {avatarUrl && !isGroup ? (
                                <Image
                                  source={{uri: avatarUrl}}
                                  style={styles.avatarImage}
                                  resizeMode="cover"
                                />
                              ) : isGroup ? (
                                <GroupIcon size="sm" style={t.atoms.text} />
                              ) : (
                                <Text style={[a.text_sm, a.font_bold]}>
                                  {initials}
                                </Text>
                              )}
                            </View>

                            <View style={[a.flex_1, a.gap_2xs]}>
                              <View
                                style={[
                                  a.flex_row,
                                  a.align_center,
                                  a.justify_between,
                                ]}>
                                <View style={[a.flex_row, a.align_center, a.gap_xs, a.flex_1]}>
                                  <Text
                                    style={[a.text_md, a.font_bold, a.flex_1]}
                                    numberOfLines={1}>
                                    {displayName}
                                  </Text>
                                  {isGroup ? (
                                    <View
                                      style={[
                                        styles.groupBadge,
                                        t.atoms.bg_contrast_50,
                                      ]}>
                                      <Text
                                        style={[
                                          styles.groupBadgeText,
                                          t.atoms.text_contrast_medium,
                                        ]}>
                                        {groupLabel}
                                      </Text>
                                    </View>
                                  ) : null}
                                </View>
                                {lastMessageTs ? (
                                  <TimeElapsed
                                    timestamp={new Date(
                                      lastMessageTs,
                                    ).toISOString()}>
                                    {({timeElapsed}) => (
                                      <Text
                                        style={[
                                          a.text_xs,
                                          t.atoms.text_contrast_medium,
                                        ]}>
                                        {timeElapsed}
                                      </Text>
                                    )}
                                  </TimeElapsed>
                                ) : null}
                              </View>
                              <Text
                                style={[
                                  a.text_sm,
                                  t.atoms.text_contrast_medium,
                                ]}
                                numberOfLines={1}>
                                {lastMessagePreview}
                              </Text>
                            </View>

                            <View style={[styles.unreadBadgeWrap]}>
                              {showUnreadBadge ? (
                                <View
                                  style={[
                                    styles.unreadBadge,
                                    {backgroundColor: t.palette.primary_500},
                                  ]}>
                                  <Text style={[styles.unreadBadgeText]}>
                                    {unreadCount}
                                  </Text>
                                </View>
                              ) : showUnreadPlaceholder ? (
                                <View
                                  style={[
                                    styles.unreadBadgePlaceholder,
                                    t.atoms.border_contrast_low,
                                  ]}
                                />
                              ) : null}
                            </View>
                          </View>
                        </Pressable>
                      )
                    })}
                  </ScrollView>
                )}
              </View>
            ) : null}

            {showThread ? (
              <View
                style={[
                  styles.threadColumn,
                  t.atoms.border_contrast_low,
                  t.atoms.bg_contrast_25,
                  isMobile && styles.threadColumnMobile,
                ]}>
                <View
                  style={[
                    styles.threadHeader,
                    t.atoms.border_contrast_low,
                    a.gap_sm,
                  ]}>
                  {isMobile ? (
                    <Button
                      label={_(msg`Retour`)}
                      color="secondary"
                      size="small"
                      variant="ghost"
                      shape="square"
                      onPress={onBackToList}>
                      <ButtonIcon icon={ArrowLeft} />
                    </Button>
                  ) : null}
                  {selectedRoomId ? (
                    <View
                      style={[
                        styles.avatarSmall,
                        t.atoms.bg_contrast_50,
                      ]}>
                      {selectedRoomAvatarUrl ? (
                        <Image
                          source={{uri: selectedRoomAvatarUrl}}
                          style={styles.avatarImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <Text style={[a.text_xs, a.font_bold]}>
                          {selectedRoomInitials}
                        </Text>
                      )}
                    </View>
                  ) : null}
                  <View style={[styles.threadTitleWrap]}>
                    <Text
                      style={[a.text_lg, a.font_bold, styles.threadTitle]}
                      numberOfLines={1}>
                      {selectedRoomTitle}
                    </Text>
                  </View>
                  {selectedRoomId && selectedRoomIsGroup ? (
                    <Button
                      label={
                        groupPanelOpen
                          ? _(msg`Masquer`)
                          : _(msg`Voir membres`)
                      }
                      color="secondary"
                      size="small"
                      variant="ghost"
                      onPress={toggleGroupPanel}>
                      <ButtonText>
                        {groupPanelOpen ? (
                          <Trans>Masquer</Trans>
                        ) : (
                          <Trans>Voir membres</Trans>
                        )}
                      </ButtonText>
                    </Button>
                  ) : null}
                </View>

                <View style={[styles.threadBody]}>
                  {selectedRoomId && selectedRoomIsGroup && groupPanelOpen ? (
                    <Card style={[styles.groupPanel]}>
                      <View style={[a.gap_md]}>
                        <Text style={[a.text_md, a.font_bold]}>
                          <Trans>Membres du groupe</Trans>
                        </Text>
                        {selectedRoomMembers.length > 0 ? (
                          <View style={[a.gap_2xs]}>
                            {selectedRoomMembers.map((member, index) => {
                              const name =
                                member?.name ||
                                member?.rawDisplayName ||
                                member?.userId ||
                                ''
                              const userId = member?.userId || ''
                              return (
                                <View
                                  key={userId || name || String(index)}
                                  style={[a.flex_row, a.justify_between]}>
                                  <Text style={[a.text_sm]} numberOfLines={1}>
                                    {name}
                                  </Text>
                                  {userId ? (
                                    <Text
                                      style={[
                                        a.text_xs,
                                        t.atoms.text_contrast_medium,
                                      ]}
                                      numberOfLines={1}>
                                      {userId}
                                    </Text>
                                  ) : null}
                                </View>
                              )
                            })}
                          </View>
                        ) : (
                          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                            <Trans>Aucun membre pour le moment.</Trans>
                          </Text>
                        )}

                        <View style={[a.gap_sm]}>
                          <Text style={[a.text_sm, a.font_bold]}>
                            <Trans>Inviter un membre</Trans>
                          </Text>
                          <TextField.Root>
                            <TextField.Input
                              label={_(msg`@utilisateur:tellus.chat`)}
                              value={inviteInput}
                              onChangeText={value => {
                                setInviteInput(value)
                                if (inviteError) setInviteError(null)
                              }}
                              autoCapitalize="none"
                              autoCorrect={false}
                            />
                          </TextField.Root>
                          {inviteError ? (
                            <Text
                              style={[
                                a.text_sm,
                                styles.errorText,
                                {color: t.palette.negative_500},
                              ]}>
                              {inviteError}
                            </Text>
                          ) : null}
                          <View style={[a.flex_row, a.justify_between]}>
                            <Button
                              label={_(msg`Inviter`)}
                              color="primary"
                              size="small"
                              variant="solid"
                              disabled={!inviteInput.trim() || isInviting}
                              onPress={onInviteToGroup}>
                              <ButtonText>
                                <Trans>Inviter</Trans>
                              </ButtonText>
                            </Button>
                            <Button
                              label={_(msg`Quitter le groupe`)}
                              color="secondary"
                              size="small"
                              variant="outline"
                              onPress={onLeaveGroup}>
                              <ButtonText>
                                <Trans>Quitter le groupe</Trans>
                              </ButtonText>
                            </Button>
                          </View>
                          {leaveError ? (
                            <Text
                              style={[
                                a.text_sm,
                                styles.errorText,
                                {color: t.palette.negative_500},
                              ]}>
                              {leaveError}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </Card>
                  ) : null}
                  {!selectedRoomId ? (
                    <StateCard
                      title={_(msg`Sélectionne une conversation`)}
                      description={_(msg`Choisis une discussion pour voir le fil.`)}
                      icon={MessageIcon}
                      tone="empty"
                    />
                  ) : messagesLoading ? (
                    <StateCard
                      title={_(msg`Chargement`)}
                      description={_(msg`Récupération des messages...`)}
                      icon={CircleInfoIcon}
                    />
                  ) : messagesError ? (
                    <StateCard
                      title={_(msg`Impossible de charger la conversation`)}
                      description={messagesError}
                      icon={CircleInfoIcon}
                      tone="error"
                      action={
                        <Button
                          label={_(msg`Réessayer`)}
                          color="secondary"
                          size="small"
                          variant="solid"
                          onPress={onRetryMessages}>
                          <ButtonText>
                            <Trans>Réessayer</Trans>
                          </ButtonText>
                          <ButtonIcon icon={RetryIcon} position="right" />
                        </Button>
                      }
                    />
                  ) : roomMessages.length === 0 ? (
                    <StateCard
                      title={_(msg`Aucun message`)}
                      description={_(msg`Commence la discussion.`)}
                      icon={MessageIcon}
                      tone="empty"
                    />
                  ) : (
                    <ScrollView
                      ref={messageListRef}
                      style={[styles.messageList]}
                      contentContainerStyle={[
                        styles.messageListContent,
                        a.gap_md,
                      ]}>
                      {roomMessages.map(message => {
                        const senderMember = selectedRoom?.getMember?.(
                          message.sender,
                        )
                        const senderName = getMemberDisplayName(senderMember)
                        const senderInitials = getInitials(
                          senderName || message.sender,
                        )
                        const senderAvatarUrl = getMemberAvatarUrl(
                          matrixClient,
                          senderMember,
                        )
                        return (
                          <View
                            key={message.id}
                            style={[
                              styles.messageRow,
                              message.isMine && styles.messageRowMine,
                            ]}>
                            {!message.isMine ? (
                              <View
                                style={[
                                  styles.avatarTiny,
                                  t.atoms.bg_contrast_50,
                                ]}>
                                {senderAvatarUrl ? (
                                  <Image
                                    source={{uri: senderAvatarUrl}}
                                    style={styles.avatarImage}
                                    resizeMode="cover"
                                  />
                                ) : (
                                  <Text style={[a.text_xs, a.font_bold]}>
                                    {senderInitials}
                                  </Text>
                                )}
                              </View>
                            ) : null}
                            <View style={[styles.messageBubbleWrap]}>
                              <View
                                style={[
                                  styles.messageBubble,
                                  t.atoms.border_contrast_low,
                                  t.atoms.bg_contrast_25,
                                  message.isMine && styles.messageBubbleMine,
                                  message.isMine && {
                                    backgroundColor: t.palette.primary_100,
                                    borderColor: t.palette.primary_300,
                                  },
                                ]}>
                                <Text style={[a.text_md]}>{message.body}</Text>
                              </View>
                              <TimeElapsed
                                timestamp={new Date(message.ts).toISOString()}>
                                {({timeElapsed}) => (
                                  <Text
                                    style={[
                                      a.text_xs,
                                      a.pt_2xs,
                                      message.isMine
                                        ? a.text_right
                                        : a.text_left,
                                      t.atoms.text_contrast_medium,
                                    ]}>
                                    {timeElapsed}
                                  </Text>
                                )}
                              </TimeElapsed>
                            </View>
                          </View>
                        )
                      })}
                    </ScrollView>
                  )}
                </View>

                <View style={[styles.composer, t.atoms.border_contrast_low]}>
                  {sendError ? (
                    <Text
                      style={[
                        a.text_sm,
                        styles.errorText,
                        {color: t.palette.negative_500},
                      ]}>
                      {sendError}
                    </Text>
                  ) : null}
                  <View style={[styles.composerRow]}>
                    <TextField.Root style={[styles.composerInput]}>
                      <TextField.Input
                        label={_(msg`Écrire un message`)}
                        value={messageInput}
                        onChangeText={setMessageInput}
                        autoCapitalize="sentences"
                        autoCorrect
                        editable={Boolean(selectedRoomId) && isReady && !isSending}
                        multiline
                        blurOnSubmit={false}
                        returnKeyType="send"
                        onKeyPress={(event: any) => {
                          const key = event?.nativeEvent?.key
                          const shiftKey = event?.nativeEvent?.shiftKey
                          if (key === 'Enter' && !shiftKey) {
                            event?.preventDefault?.()
                            onSendMessage()
                          }
                        }}
                      />
                    </TextField.Root>
                    <Button
                      label={_(msg`Envoyer`)}
                      color="primary"
                      size="small"
                      variant="solid"
                      disabled={!canSend}
                      onPress={onSendMessage}>
                      <ButtonText>
                        <Trans>Envoyer</Trans>
                      </ButtonText>
                    </Button>
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        </View>
      )}
    </PageShell>
  )
}

export default MessagesScreen

const styles = StyleSheet.create({
  contentContainer: {
    alignItems: 'center',
    paddingBottom: 48,
  },
  column: {
    width: '100%',
    maxWidth: 900,
  },
  cardNarrow: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  readyContainer: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  chatLayout: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    flexDirection: 'row',
  },
  listColumn: {
    flexBasis: 320,
    flexShrink: 0,
    flexGrow: 0,
    gap: 16,
    minWidth: 0,
    minHeight: 0,
  },
  listColumnMobile: {
    width: '100%',
    flexBasis: 'auto',
    flexGrow: 1,
  },
  listScroll: {
    flex: 1,
    minHeight: 0,
  },
  listScrollContent: {
    paddingBottom: 12,
  },
  roomButton: {
    width: '100%',
    minWidth: 0,
  },
  roomButtonSelected: {
    borderWidth: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarTiny: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  unreadBadgeWrap: {
    minWidth: 24,
    alignItems: 'flex-end',
  },
  unreadBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  unreadBadgePlaceholder: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
  },
  threadColumn: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  threadColumnMobile: {
    borderRadius: 0,
    borderWidth: 0,
  },
  threadHeader: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  threadTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  threadTitle: {
    flexShrink: 1,
    minWidth: 0,
  },
  threadBody: {
    flex: 1,
    minHeight: 0,
    padding: 16,
  },
  groupBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  groupBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  groupPanel: {
    marginBottom: 12,
  },
  messageList: {
    flex: 1,
    minHeight: 0,
  },
  messageListContent: {
    paddingBottom: 16,
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    gap: 8,
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
  messageBubbleWrap: {
    maxWidth: '78%',
    flexShrink: 1,
  },
  messageBubble: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  messageBubbleMine: {
    alignSelf: 'flex-end',
  },
  composer: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  composerInput: {
    flex: 1,
  },
  errorText: {
    paddingTop: 8,
  },
})
