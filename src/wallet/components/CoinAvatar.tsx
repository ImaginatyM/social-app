import React from 'react'
import {Image, Text, View} from 'react-native'

type Props = {
  symbol: string
  imageUrl?: string
  size?: number
}

export function CoinAvatar({symbol, imageUrl, size = 36}: Props) {
  const [failed, setFailed] = React.useState(false)
  const label = symbol.slice(0, 4).toUpperCase()
  const showImage = Boolean(imageUrl) && !failed

  return (
    <View
      style={{width: size, height: size}}
      className="items-center justify-center rounded-full bg-slate-800">
      {showImage ? (
        <Image
          source={{uri: imageUrl}}
          style={{width: size, height: size, borderRadius: size / 2}}
          resizeMode="contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <Text className="text-xs font-semibold text-slate-200">{label}</Text>
      )}
    </View>
  )
}
