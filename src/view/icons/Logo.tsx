import React from 'react'
import {Image} from 'expo-image'

type Props = {
  width?: number
  height?: number
  style?: any
}

export const Logo = React.forwardRef(function LogoImpl(props: Props, ref) {
  const {width = 1600} = props // Légèrement réduit
  return (
    <Image
      source={require('./custom-logo.svg')}
      accessibilityLabel="Logo"
      accessibilityHint="Logo de l'application"
      accessibilityIgnoresInvertColors
      contentFit="contain"
      style={{
        height: width,
        width: width * 2.5,
        transform: [{scale: 2.4}], // Légèrement réduit
        alignSelf: 'center'
      }}
    />
  )
})