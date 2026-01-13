import {useEffect, useRef} from 'react'

const playing = new Set<HTMLVideoElement>()

export function pauseAll(except?: HTMLVideoElement) {
  for (const v of playing) {
    if (v === except) continue
    try {
      v.pause()
    } catch {}
  }
}

export default function useAutoplayInView(
  onEnter: (el: HTMLVideoElement) => void,
  onLeave: (el: HTMLVideoElement) => void,
) {
  const ref = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const root = (document.querySelector('[data-feed-scroll]') as Element) ?? null
    const io = new IntersectionObserver(
      entries => {
        const entry = entries[0]
        if (!entry) return
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
          onEnter(el)
        } else {
          onLeave(el)
        }
      },
      {root, threshold: [0, 0.25, 0.6, 0.9, 1]},
    )
    io.observe(el)
    return () => io.disconnect()
  }, [onEnter, onLeave])

  useEffect(() => {
    const vis = () => {
      if (document.hidden) pauseAll()
    }
    document.addEventListener('visibilitychange', vis)
    return () => document.removeEventListener('visibilitychange', vis)
  }, [])

  return ref
}

export {playing}
