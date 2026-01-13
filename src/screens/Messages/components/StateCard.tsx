import React from 'react'
import {View} from 'react-native'

import {atoms as a, useTheme} from '#/alf'
import {type Props as SVGIconProps} from '#/components/icons/common'
import {Text} from '#/components/Typography'
import {Card} from './Card'

type Tone = 'info' | 'error' | 'empty'

export function StateCard({
  title,
  description,
  icon: Icon,
  tone = 'info',
  action,
}: {
  title: string
  description?: string
  icon: React.ComponentType<SVGIconProps>
  tone?: Tone
  action?: React.ReactNode
}) {
  const t = useTheme()
  const iconColor =
    tone === 'error'
      ? t.palette.negative_500
      : tone === 'empty'
        ? t.palette.primary_500
        : t.atoms.text_contrast_medium.color

  return (
    <Card>
      <View style={[a.align_center, a.gap_sm]}>
        <Icon size="lg" style={{color: iconColor}} />
        <Text style={[a.text_lg, a.font_bold]}>{title}</Text>
        {description ? (
          <Text
            style={[
              a.text_center,
              a.text_md,
              a.leading_snug,
              t.atoms.text_contrast_medium,
            ]}>
            {description}
          </Text>
        ) : null}
        {action ? <View style={[a.pt_sm]}>{action}</View> : null}
      </View>
    </Card>
  )
}
