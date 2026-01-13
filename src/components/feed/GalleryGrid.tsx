import React, {useEffect, useRef, useState} from 'react'
import {
  getPostImages,
  getCounts,
  hasMultipleImages,
  isVideo,
} from '../../lib/feed/mediaHelpers'
import HeartBurst from './HeartBurst'

type Props = {
  posts: any[]
  onOpen: (p: any) => void
  onLike?: (p: any) => void
  onSave?: (p: any) => void
}

type TileProps = {
  post: any
  index: number
  onOpen: (p: any) => void
  onLike?: (p: any) => void
  onSave?: (p: any) => void
}

function GalleryTile({post, index, onOpen, onLike, onSave}: TileProps) {
  const img = getPostImages(post)[0]
  const holdRef = useRef<number | null>(null)
  const [burstToken, setBurstToken] = useState(0)

  if (!img) {
    return null
  }

  const {like, comment} = getCounts(post)
  const multi = hasMultipleImages(post)
  const video = isVideo(post)

  const key = post?.uri || index

  const handleMouseUp = () => {
    if (holdRef.current) {
      clearTimeout(holdRef.current)
      holdRef.current = null
    }
  }

  return (
    <div
      key={key}
      onClick={() => onOpen(post)}
      onDoubleClick={e => {
        e.stopPropagation()
        setBurstToken(n => n + 1)
        onLike?.(post)
      }}
      onMouseDown={() => {
        holdRef.current = window.setTimeout(() => onSave?.(post), 600)
      }}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        position: 'relative',
        borderRadius: 12,
        overflow: 'hidden',
        background: '#f2f2f2',
        cursor: 'pointer',
      }}>
      {/* image carrée */}
      <img
        src={img.url}
        loading="lazy"
        style={{width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block'}}
        alt=""
      />

      <HeartBurst trigger={burstToken} />

      {/* coin haut droit : multi-image ou vidéo */}
      {(multi || video) && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'rgba(0,0,0,.55)',
            color: '#fff',
            fontSize: 12,
            padding: '4px 6px',
            borderRadius: 8,
          }}>
          {video ? '▶︎' : '▦'}
        </div>
      )}

      {/* overlay gradient bas : likes • comments */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '8px 10px',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          color: '#fff',
          background: 'linear-gradient(transparent, rgba(0,0,0,.45))',
        }}>
        <span>❤️ {like}</span>
        <span>💬 {comment}</span>
      </div>
    </div>
  )
}

export default function GalleryGrid({posts, onOpen, onLike, onSave}: Props) {
  const [cols, setCols] = useState(3)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const upd = () =>
      setCols(window.innerWidth >= 1024 ? 3 : window.innerWidth >= 640 ? 2 : 1)
    upd()
    window.addEventListener('resize', upd)
    return () => window.removeEventListener('resize', upd)
  }, [])

  useEffect(() => {
    if (!sentinelRef.current) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          window.dispatchEvent(new CustomEvent('gallery:loadMore'))
        }
      },
      {rootMargin: '1000px'},
    )
    io.observe(sentinelRef.current)
    return () => io.disconnect()
  }, [])

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols},1fr)`,
        gap: 4,
      }}>
      {posts.map((post, index) => (
        <GalleryTile
          key={post?.uri || index}
          post={post}
          index={index}
          onOpen={onOpen}
          onLike={onLike}
          onSave={onSave}
        />
      ))}
      <div ref={sentinelRef} style={{height: 1}} />
    </div>
  )
}
