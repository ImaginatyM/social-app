import React, {useEffect, useRef, useState} from 'react'
import {getPostVideo, isVideoOnly} from '../../lib/feed/mediaHelpers'

export default function ImmersiveReels({posts}: {posts: any[]}) {
  const vids = posts.filter(isVideoOnly)
  const [idx, setIdx] = useState(0)
  const boxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > 16) {
        setIdx((i) =>
          Math.max(0, Math.min(vids.length - 1, i + (e.deltaY > 0 ? 1 : -1))),
        )
      }
    }
    const el = boxRef.current
    if (el) {
      el.addEventListener('wheel', onWheel, {passive: true})
    }
    return () => {
      if (el) {
        el.removeEventListener('wheel', onWheel)
      }
    }
  }, [vids.length])

  const v = vids[idx]
  const vd = v && getPostVideo(v)

  return (
    <div
      ref={boxRef}
      style={{
        height: 'calc(100vh - 120px)',
        background: '#000',
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
      }}>
      {v ? (
        <video
          key={v?.uri || idx}
          src={vd?.url}
          poster={vd?.thumb}
          autoPlay
          controls
          style={{height: '100%', maxWidth: '100%'}}
          playsInline
        />
      ) : (
        <div style={{color: '#fff', padding: 24}}>Aucune vidéo</div>
      )}
    </div>
  )
}
