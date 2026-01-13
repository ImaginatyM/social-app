import React from 'react'
import {View, type StyleProp, type ViewStyle} from 'react-native'

import {atoms as a, useTheme} from '#/alf'

export function Card({
  children,
  style,
}: React.PropsWithChildren<{style?: StyleProp<ViewStyle>}>) {
  const t = useTheme()
  return (
    <View
      style={[
        a.p_md,
        a.rounded_md,
        a.border,
        t.atoms.border_contrast_low,
        t.atoms.bg_contrast_25,
        style,
      ]}>
      {children}
    </View>
  )
}
