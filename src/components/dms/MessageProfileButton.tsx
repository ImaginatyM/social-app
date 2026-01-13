import React from 'react'
import {View} from 'react-native'
import {type AppBskyActorDefs} from '@atproto/api'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useNavigation} from '@react-navigation/native'

import {getTellusProfile} from '#/lib/tellusProfileRecord'
import {useRequireEmailVerification} from '#/lib/hooks/useRequireEmailVerification'
import {type NavigationProp} from '#/lib/routes/types'
import {useGetConvoAvailabilityQuery} from '#/state/queries/messages/get-convo-availability'
import {useAgent} from '#/state/session'
import * as Toast from '#/view/com/util/Toast'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {canBeMessaged} from '#/components/dms/util'
import {Message_Stroke2_Corner0_Rounded as Message} from '#/components/icons/Message'
import * as Menu from '#/components/Menu'
import openMatrixDM from '../../lib/openMatrixDM'

function useTellusMessageAction(
  profile: AppBskyActorDefs.ProfileViewDetailed,
) {
  const {_} = useLingui()
  const agent = useAgent()
  const navigation = useNavigation<NavigationProp>()
  const requireEmailVerification = useRequireEmailVerification()
  const {data: convoAvailability} = useGetConvoAvailabilityQuery(profile.did)
  const [tellusMatrixId, setTellusMatrixId] = React.useState<
    string | null | undefined
  >(undefined)
  const [tellusStatus, setTellusStatus] = React.useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle')

  const normalizedHandle = React.useMemo(() => {
    const handle = profile?.handle?.trim() || ''
    if (!handle) return ''
    return handle.startsWith('@') ? handle : `@${handle}`
  }, [profile?.handle])

  React.useEffect(() => {
    let mounted = true
    if (!convoAvailability?.canChat || !profile?.did) return
    setTellusStatus('loading')
    getTellusProfile(profile.did, agent)
      .then(result => {
        if (!mounted) return
        setTellusMatrixId(result?.matrixId ?? null)
        setTellusStatus('ready')
      })
      .catch(err => {
        if (!mounted) return
        console.error(err)
        setTellusStatus('error')
      })
    return () => {
      mounted = false
    }
  }, [agent, convoAvailability?.canChat, profile?.did])

  const onPress = React.useCallback(async () => {
    if (!convoAvailability?.canChat) {
      return
    }

    try {
      let matrixId = tellusMatrixId
      if (tellusStatus !== 'ready') {
        setTellusStatus('loading')
        const result = await getTellusProfile(profile.did, agent)
        matrixId = result?.matrixId ?? null
        setTellusMatrixId(matrixId)
        setTellusStatus('ready')
      }
      if (!matrixId) {
        navigation.navigate('MessagesInvite', {handle: normalizedHandle})
        return
      }
      const roomId = await openMatrixDM(
        matrixId,
        navigation,
        normalizedHandle,
      )
      if (!roomId) return
    } catch (e) {
      console.error(e)
      setTellusStatus('error')
      Toast.show(_(msg`Impossible d’ouvrir Tellus Chat`))
    }
  }, [
    agent,
    convoAvailability,
    navigation,
    normalizedHandle,
    profile?.did,
    tellusMatrixId,
    tellusStatus,
    _,
  ])

  const wrappedOnPress = requireEmailVerification(onPress, {
    instructions: [
      <Trans key="message">
        Before you can message another user, you must first verify your email.
      </Trans>,
    ],
  })

  const shouldInvite = tellusStatus === 'ready' && !tellusMatrixId
  const buttonLabel = shouldInvite
    ? normalizedHandle
      ? _(msg`Inviter ${normalizedHandle} sur Tellus Chat`)
      : _(msg`Inviter sur Tellus Chat`)
    : normalizedHandle
      ? _(msg`Message ${normalizedHandle} sur Tellus Chat`)
      : _(msg`Message sur Tellus Chat`)

  return {
    convoAvailability,
    shouldInvite,
    buttonLabel,
    onPress: wrappedOnPress,
  }
}

export function MessageProfileButton({
  profile,
}: {
  profile: AppBskyActorDefs.ProfileViewDetailed
}) {
  const t = useTheme()
  const {convoAvailability, shouldInvite, buttonLabel, onPress} =
    useTellusMessageAction(profile)

  if (!convoAvailability) {
    // show pending state based on declaration
    if (canBeMessaged(profile)) {
      return (
        <View
          testID="dmBtnLoading"
          aria-hidden={true}
          style={[
            a.justify_center,
            a.align_center,
            t.atoms.bg_contrast_25,
            a.rounded_full,
            // Matches size of button below to avoid layout shift
            {width: 33, height: 33},
          ]}>
          <Message style={[t.atoms.text, {opacity: 0.3}]} size="md" />
        </View>
      )
    } else {
      return null
    }
  }

  if (convoAvailability.canChat) {
    return (
      <Button
        accessibilityRole="button"
        testID="dmBtn"
        size="small"
        color="secondary"
        variant="solid"
        shape="round"
        label={buttonLabel}
        style={[a.justify_center]}
        onPress={onPress}>
        <ButtonIcon icon={Message} size="md" />
        <ButtonText>
          {shouldInvite ? (
            <Trans>Inviter sur Tellus Chat</Trans>
          ) : (
            <Trans>Message (Tellus Chat)</Trans>
          )}
        </ButtonText>
      </Button>
    )
  } else {
    return null
  }
}

export function MessageProfileMenuItem({
  profile,
}: {
  profile: AppBskyActorDefs.ProfileViewDetailed
}) {
  const {convoAvailability, shouldInvite, buttonLabel, onPress} =
    useTellusMessageAction(profile)

  if (!convoAvailability?.canChat) {
    return null
  }

  return (
    <Menu.Item label={buttonLabel} onPress={onPress}>
      <Menu.ItemText>
        {shouldInvite ? (
          <Trans>Inviter sur Tellus Chat</Trans>
        ) : (
          <Trans>Message (Tellus Chat)</Trans>
        )}
      </Menu.ItemText>
      <Menu.ItemIcon icon={Message} />
    </Menu.Item>
  )
}
