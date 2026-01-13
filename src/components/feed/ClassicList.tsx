import React from 'react'

export default function ClassicList({children}: {children: React.ReactNode}) {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
      {children}
    </div>
  )
}
// On s’en servira pour entourer TON composant qui rend déjà les posts Tellus.
