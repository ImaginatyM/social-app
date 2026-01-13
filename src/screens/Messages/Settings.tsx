import {useCallback, useEffect, useState} from 'react'
import {View} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {
  getTellusProfile,
  setTellusProfile,
  validateMatrixId,
} from '#/lib/tellusProfileRecord'
import {type CommonNavigatorParams} from '#/lib/routes/types'
import {isNative} from '#/platform/detection'
import {useUpdateActorDeclaration} from '#/state/queries/messages/actor-declaration'
import {useProfileQuery} from '#/state/queries/profile'
import {useAgent, useSession} from '#/state/session'
import * as Toast from '#/view/com/util/Toast'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import {Divider} from '#/components/Divider'
import * as Toggle from '#/components/forms/Toggle'
import * as TextField from '#/components/forms/TextField'
import * as Layout from '#/components/Layout'
import {Text} from '#/components/Typography'
import {useBackgroundNotificationPreferences} from '../../../modules/expo-background-notification-handler/src/BackgroundNotificationHandlerProvider'

type AllowIncoming = 'all' | 'none' | 'following'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'MessagesSettings'>

export function MessagesSettingsScreen(props: Props) {
  return <MessagesSettingsScreenInner {...props} />
}

export function MessagesSettingsScreenInner({}: Props) {
  const {_} = useLingui()
  const t = useTheme()
  const agent = useAgent()
  const {currentAccount} = useSession()
  const {data: profile} = useProfileQuery({
    did: currentAccount!.did,
  })
  const {preferences, setPref} = useBackgroundNotificationPreferences()
  const [matrixIdInput, setMatrixIdInput] = useState('')
  const [savedMatrixId, setSavedMatrixId] = useState<string | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [status, setStatus] = useState<{
    tone: 'success' | 'error'
    message: string
  } | null>(null)

  const {mutate: updateDeclaration} = useUpdateActorDeclaration({
    onError: () => {
      Toast.show(_(msg`Failed to update settings`), 'xmark')
    },
  })

  const onSelectMessagesFrom = useCallback(
    (keys: string[]) => {
      const key = keys[0]
      if (!key) return
      updateDeclaration(key as AllowIncoming)
    },
    [updateDeclaration],
  )

  const onSelectSoundSetting = useCallback(
    (keys: string[]) => {
      const key = keys[0]
      if (!key) return
      setPref('playSoundChat', key === 'enabled')
    },
    [setPref],
  )

  useEffect(() => {
    let mounted = true
    if (!currentAccount) return
    setLoadingProfile(true)
    getTellusProfile(currentAccount.did, agent)
      .then(result => {
        if (!mounted) return
        const matrixId = result?.matrixId ?? null
        setSavedMatrixId(matrixId)
        setMatrixIdInput(matrixId ?? '')
      })
      .catch(err => {
        if (!mounted) return
        console.error('tellus profile load failed', err)
        setStatus({
          tone: 'error',
          message: _(msg`Unable to load Tellus Chat ID.`),
        })
      })
      .finally(() => {
        if (!mounted) return
        setLoadingProfile(false)
      })
    return () => {
      mounted = false
    }
  }, [agent, currentAccount, _])

  const onSaveTellusId = useCallback(async () => {
    if (!currentAccount) return
    setStatus(null)
    setFieldError(null)
    const validation = validateMatrixId(matrixIdInput)
    if (!validation.ok) {
      setFieldError(
        validation.error === 'empty'
          ? _(msg`Enter your Tellus Chat ID.`)
          : _(msg`Enter a valid Matrix ID (example: @alice:matrix.org).`),
      )
      return
    }
    setSavingProfile(true)
    try {
      await setTellusProfile(validation.normalized, agent)
      setSavedMatrixId(validation.normalized)
      setMatrixIdInput(validation.normalized)
      setStatus({tone: 'success', message: _(msg`Tellus Chat ID saved.`)})
    } catch (err) {
      console.error('tellus profile save failed', err)
      setStatus({
        tone: 'error',
        message: _(msg`Unable to save Tellus Chat ID.`),
      })
    } finally {
      setSavingProfile(false)
    }
  }, [agent, currentAccount, matrixIdInput, _])

  const onDeleteTellusId = useCallback(async () => {
    if (!currentAccount) return
    setStatus(null)
    setFieldError(null)
    setSavingProfile(true)
    try {
      await setTellusProfile(null, agent)
      setSavedMatrixId(null)
      setMatrixIdInput('')
      setStatus({tone: 'success', message: _(msg`Tellus Chat ID removed.`)})
    } catch (err) {
      console.error('tellus profile delete failed', err)
      setStatus({
        tone: 'error',
        message: _(msg`Unable to delete Tellus Chat ID.`),
      })
    } finally {
      setSavingProfile(false)
    }
  }, [agent, currentAccount, _])

  return (
    <Layout.Screen testID="messagesSettingsScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Tellus Chat settings</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <View style={[a.p_lg, a.gap_md]}>
          <View style={[a.gap_sm]}>
            <Text style={[a.text_lg, a.font_bold]}>
              <Trans>Tellus Chat</Trans>
            </Text>
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
              <Trans>
                Add your Tellus Chat ID so others can message you directly.
              </Trans>
            </Text>
          </View>
          <View style={[a.gap_sm]}>
            <TextField.LabelText>
              <Trans>My Tellus Chat ID (Matrix ID)</Trans>
            </TextField.LabelText>
            <TextField.Root isInvalid={Boolean(fieldError)}>
              <TextField.Input
                label={_(msg`@alice:matrix.org`)}
                value={matrixIdInput}
                onChangeText={value => {
                  setMatrixIdInput(value)
                  if (fieldError) setFieldError(null)
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </TextField.Root>
            {fieldError ? (
              <Text style={[a.text_sm, {color: t.palette.negative_500}]}>
                {fieldError}
              </Text>
            ) : null}
            {loadingProfile ? (
              <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                <Trans>Loading Tellus Chat ID...</Trans>
              </Text>
            ) : null}
          </View>
          <View style={[a.flex_row, a.gap_sm]}>
            <Button
              label={_(msg`Save`)}
              color="primary"
              size="small"
              variant="solid"
              disabled={savingProfile || loadingProfile}
              onPress={onSaveTellusId}>
              <ButtonText>
                <Trans>Save</Trans>
              </ButtonText>
            </Button>
            {savedMatrixId ? (
              <Button
                label={_(msg`Delete`)}
                color="secondary"
                size="small"
                variant="outline"
                disabled={savingProfile}
                onPress={onDeleteTellusId}>
                <ButtonText>
                  <Trans>Delete</Trans>
                </ButtonText>
              </Button>
            ) : null}
          </View>
          {status ? (
            <Text
              style={[
                a.text_sm,
                status.tone === 'error'
                  ? {color: t.palette.negative_500}
                  : t.atoms.text_contrast_medium,
              ]}>
              {status.message}
            </Text>
          ) : null}
          <Divider style={a.my_md} />
          <Text style={[a.text_lg, a.font_bold]}>
            <Trans>Allow new messages from</Trans>
          </Text>
          <Toggle.Group
            label={_(msg`Allow new messages from`)}
            type="radio"
            values={[
              (profile?.associated?.chat?.allowIncoming as AllowIncoming) ??
                'following',
            ]}
            onChange={onSelectMessagesFrom}>
            <View>
              <Toggle.Item
                name="all"
                label={_(msg`Everyone`)}
                style={[a.justify_between, a.py_sm]}>
                <Toggle.LabelText>
                  <Trans>Everyone</Trans>
                </Toggle.LabelText>
                <Toggle.Radio />
              </Toggle.Item>
              <Toggle.Item
                name="following"
                label={_(msg`Users I follow`)}
                style={[a.justify_between, a.py_sm]}>
                <Toggle.LabelText>
                  <Trans>Users I follow</Trans>
                </Toggle.LabelText>
                <Toggle.Radio />
              </Toggle.Item>
              <Toggle.Item
                name="none"
                label={_(msg`No one`)}
                style={[a.justify_between, a.py_sm]}>
                <Toggle.LabelText>
                  <Trans>No one</Trans>
                </Toggle.LabelText>
                <Toggle.Radio />
              </Toggle.Item>
            </View>
          </Toggle.Group>
          <Admonition type="tip">
            <Trans>
              You can continue ongoing conversations regardless of which setting
              you choose.
            </Trans>
          </Admonition>
          {isNative && (
            <>
              <Divider style={a.my_md} />
              <Text style={[a.text_lg, a.font_bold]}>
                <Trans>Notification Sounds</Trans>
              </Text>
              <Toggle.Group
                label={_(msg`Notification sounds`)}
                type="radio"
                values={[preferences.playSoundChat ? 'enabled' : 'disabled']}
                onChange={onSelectSoundSetting}>
                <View>
                  <Toggle.Item
                    name="enabled"
                    label={_(msg`Enabled`)}
                    style={[a.justify_between, a.py_sm]}>
                    <Toggle.LabelText>
                      <Trans>Enabled</Trans>
                    </Toggle.LabelText>
                    <Toggle.Radio />
                  </Toggle.Item>
                  <Toggle.Item
                    name="disabled"
                    label={_(msg`Disabled`)}
                    style={[a.justify_between, a.py_sm]}>
                    <Toggle.LabelText>
                      <Trans>Disabled</Trans>
                    </Toggle.LabelText>
                    <Toggle.Radio />
                  </Toggle.Item>
                </View>
              </Toggle.Group>
            </>
          )}
        </View>
      </Layout.Content>
    </Layout.Screen>
  )
}
