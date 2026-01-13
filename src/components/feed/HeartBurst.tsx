import React, {useEffect, useState} from 'react'

export default function HeartBurst({trigger}: {trigger: any}) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!trigger) return
    setShow(true)
    const t = setTimeout(() => setShow(false), 650)
    return () => clearTimeout(t)
  }, [trigger])
  if (!show) return null
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}>
      <div
        style={{
          fontSize: 80,
          transform: 'scale(1)',
          animation: 'pop .65s ease-out',
          color: 'rgba(255,255,255,.9)',
          textShadow: '0 6px 20px rgba(0,0,0,.35)',
        }}>
        ❤️
      </div>
      <style>{`@keyframes pop{0%{transform:scale(.4);opacity:0}40%{transform:scale(1.05);opacity:1}100%{transform:scale(1);opacity:0}}`}</style>
    </div>
  )
}
