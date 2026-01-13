import React from 'react'
import {View} from 'react-native'
import Svg, {Polyline} from 'react-native-svg'

export function Sparkline({
  points,
  color = '#22c55e',
  width = 96,
  height = 36,
}: {
  points?: number[]
  color?: string
  width?: number
  height?: number
}) {
  const safePoints = points && points.length ? points : [0.5, 0.5]
  const step = safePoints.length > 1 ? width / (safePoints.length - 1) : width
  const linePoints = safePoints
    .map((point, index) => {
      const x = index * step
      const y = height - point * height
      return `${x},${y}`
    })
    .join(' ')

  return (
    <View style={{width, height}}>
      <Svg width={width} height={height}>
        <Polyline
          points={linePoints}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  )
}
