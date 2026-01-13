import React, {useCallback, useMemo} from 'react'
import {View} from 'react-native'
import {setStringAsync} from 'expo-clipboard'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {shareText, shareUrl} from '#/lib/sharing'
import {type CommonNavigatorParams} from '#/lib/routes/types'
import * as Toast from '#/view/com/util/Toast'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Layout from '#/components/Layout'
import {Text} from '#/components/Typography'
import {Card} from '#/screens/Messages/components/Card'

const DEFAULT_INVITE_URL = 'https://tellus.chat'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'MessagesInvite'>

export function MessagesInviteScreen({route}: Props) {
  const {_} = useLingui()
  const t = useTheme()
  const handle = (route.params?.handle ?? '').trim()
  const displayHandle = handle
    ? handle.startsWith('@')
      ? handle
      : `@${handle}`
    : ''

  const inviteUrl = useMemo(() => {
    if (!displayHandle) return DEFAULT_INVITE_URL
    const handleParam = encodeURIComponent(displayHandle.replace(/^@/, ''))
    return `${DEFAULT_INVITE_URL}/invite?handle=${handleParam}`
  }, [displayHandle])

  const inviteMessage = useMemo(() => {
    if (displayHandle) {
      return _(
        msg`Rejoins-moi sur Tellus Chat pour discuter avec ${displayHandle} : ${inviteUrl}`,
      )
    }
    return _(msg`Rejoins-moi sur Tellus Chat pour discuter : ${inviteUrl}`)
  }, [_, displayHandle, inviteUrl])

  const onCopyLink = useCallback(async () => {
    await setStringAsync(inviteUrl)
    Toast.show(_(msg`Lien copié`), 'clipboard-check')
  }, [inviteUrl, _])

  const onShareLink = useCallback(async () => {
    await shareUrl(inviteUrl)
  }, [inviteUrl])

  const onShareMessage = useCallback(async () => {
    await shareText(inviteMessage)
  }, [inviteMessage])

  return (
    <Layout.Screen>
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Inviter sur Tellus Chat</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>

      <Layout.Content>
        <View style={[a.gap_lg]}>
          <Card>
            <View style={[a.gap_sm]}>
              <Text style={[a.text_lg, a.font_bold]}>
                <Trans>Cette personne n’est pas encore sur Tellus Chat</Trans>
              </Text>
              <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
                <Trans>
                  Invite-la pour démarrer la discussion. Elle pourra créer son
                  compte puis revenir ici.
                </Trans>
              </Text>
            </View>
          </Card>

          <View style={[a.gap_sm]}>
            <Button
              label={_(msg`Copier le lien d’invitation`)}
              color="primary"
              size="large"
              variant="solid"
              onPress={onCopyLink}>
              <ButtonText>
                <Trans>Copier le lien d’invitation</Trans>
              </ButtonText>
            </Button>
            <Button
              label={_(msg`Partager le lien`)}
              color="secondary"
              size="large"
              variant="solid"
              onPress={onShareLink}>
              <ButtonText>
                <Trans>Partager le lien</Trans>
              </ButtonText>
            </Button>
            <Button
              label={_(msg`Partager un message`)}
              color="secondary"
              size="large"
              variant="outline"
              onPress={onShareMessage}>
              <ButtonText>
                <Trans>Partager un message</Trans>
              </ButtonText>
            </Button>
          </View>

          <Card>
            <View style={[a.gap_sm]}>
              <Text style={[a.text_md, a.font_bold]}>
                <Trans>Pourquoi l’inviter ?</Trans>
              </Text>
              <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                <Trans>
                  Tellus Chat te permet de continuer les discussions initiées
                  sur le réseau social, en privé, avec la même simplicité.
                </Trans>
              </Text>
            </View>
          </Card>
        </View>
      </Layout.Content>
    </Layout.Screen>
  )
}

export default MessagesInviteScreen
