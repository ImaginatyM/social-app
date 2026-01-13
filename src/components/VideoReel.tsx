import React from 'react'

let HlsLib: any
async function ensureHls() {
  if (!HlsLib) {
    const mod = await import('hls.js')
    HlsLib = mod.default || mod
  }
}

type Props = {
  src: string
  poster?: string
  className?: string
  onPlayingChange?: (playing: boolean) => void
  active?: boolean
}

export default function VideoReel({ src, poster, className, onPlayingChange, active = true }: Props) {
  const ref = React.useRef<HTMLVideoElement | null>(null)
  const hlsRef = React.useRef<any>(null)
  const ioRef = React.useRef<IntersectionObserver | null>(null)
  const rafRef = React.useRef<number | null>(null)
  const [fitClass, setFitClass] = React.useState<'fitContain' | 'fitCover'>('fitContain')

  const isHls = src.endsWith('.m3u8')

  React.useEffect(() => {
    const video = ref.current
    if (!video) return
    let cancelled = false

    async function attach() {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
      video.removeAttribute('src'); video.load()

      if (isHls) {
        await ensureHls()
        if (cancelled) return
        if (HlsLib?.isSupported()) {
          const hls = new HlsLib({ maxBufferLength: 20, backBufferLength: 30 })
          hlsRef.current = hls
          hls.attachMedia(video)
          hls.on(HlsLib.Events.MEDIA_ATTACHED, () => hls.loadSource(src))
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = src
        } else {
          video.src = src
        }
      } else {
        video.src = src
      }
    }

    attach()
    return () => { cancelled = true; if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null } }
  }, [src, isHls])

  React.useEffect(() => {
    const video = ref.current
    if (!video) return

    const handle = (entries: IntersectionObserverEntry[]) => {
      const entry = entries[0]
      const visible = entry.isIntersecting && entry.intersectionRatio >= 0.6 && active
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        if (visible) {
          video.muted = true
          ;(video as any).playsInline = true
          document.querySelectorAll('video').forEach(v => { if (v !== video) { try { v.pause() } catch {} } })
          const p = video.play()
          if (p && typeof p.then === 'function') { p.catch(() => {/* ignore */}) }
          onPlayingChange?.(true)
        } else {
          video.pause()
          onPlayingChange?.(false)
        }
      })
    }

    const io = new IntersectionObserver(handle, {
      root: null,
      threshold: [0, 0.25, 0.5, 0.6, 0.75, 1],
    })
    io.observe(video)
    ioRef.current = io

    const onHide = () => video.pause()
    document.addEventListener('visibilitychange', onHide)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      io.disconnect()
      ioRef.current = null
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [active, onPlayingChange])

  React.useEffect(() => {
    const video = ref.current
    if (!video) return
    setFitClass('fitContain')

    const onLoadedMetadata = () => {
      const ratio = video.videoWidth / (video.videoHeight || 1)
      const isLandscape = ratio > 1.05
      const isTiktokPortrait = ratio < 0.75 && ratio > 0.45
      if (isLandscape) {
        setFitClass('fitContain')
      } else if (isTiktokPortrait) {
        setFitClass('fitCover')
      } else {
        setFitClass('fitContain')
      }
    }

    video.addEventListener('loadedmetadata', onLoadedMetadata)
    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata)
    }
  }, [src])

  return (
    <video
      ref={ref}
      className={[className, fitClass].filter(Boolean).join(' ')}
      poster={poster}
      muted
      playsInline
      autoPlay
      preload="metadata"
      controls={false}
      style={{
        width: '100%',
        height: '100%',
        background: '#000',
      }}
      crossOrigin="anonymous"
    />
  )
}
