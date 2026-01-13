import React from 'react'
import {View} from 'react-native'

import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {HITSLOP_30} from '#/lib/constants'
import {useSetDrawerOpen} from '#/state/shell'
import {Button, ButtonIcon} from '#/components/Button'
import * as Layout from '#/components/Layout'
import {Menu_Stroke2_Corner0_Rounded as Menu} from '#/components/icons/Menu'
import {Text} from '#/components/Typography'

export function PageShell({
  title,
  action,
  children,
  testID,
}: React.PropsWithChildren<{
  title: string
  action?: React.ReactNode
  testID?: string
}>) {
  const t = useTheme()
  const {_} = useLingui()
  const {gtMobile} = useBreakpoints()
  const setDrawerOpen = useSetDrawerOpen()
  return (
    <Layout.Screen testID={testID}>
      <View
        style={[a.px_lg, a.pt_lg, a.pb_md, a.border_b, t.atoms.border_contrast_low]}>
        <View
          style={[
            a.flex_row,
            a.flex_wrap,
            a.align_center,
            a.justify_between,
            a.gap_md,
          ]}>
          {!gtMobile ? (
            <Button
              label={_(msg`Open drawer menu`)}
              size="small"
              variant="ghost"
              color="secondary"
              shape="square"
              hitSlop={HITSLOP_30}
              onPress={() => setDrawerOpen(true)}
              style={[a.bg_transparent]}>
              <ButtonIcon icon={Menu} size="lg" />
            </Button>
          ) : null}
          <Text
            style={[
              a.text_2xl,
              a.font_bold,
              {flexGrow: 1, flexShrink: 1, minWidth: 0},
            ]}>
            {title}
          </Text>
          {action ? (
            <View style={[a.flex_row, a.flex_wrap, a.gap_sm, a.align_center]}>
              {action}
            </View>
          ) : null}
        </View>
      </View>
      <View style={[a.flex_1, a.px_lg, a.py_lg]}>{children}</View>
    </Layout.Screen>
  )
}
