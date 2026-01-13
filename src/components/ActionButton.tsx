import React from 'react'
import clsx from 'clsx'

type IconComponent = React.ComponentType<{
  size?: any
  fill?: string
  style?: any
  width?: number
  height?: number
}>

type Props = {
  icon: IconComponent
  label: string
  ariaLabel?: string
  onClick: () => void
  count?: number
  active?: boolean
  layout?: 'row' | 'column'
  variant?: 'like' | 'comment' | 'save' | 'share' | 'reply'
  className?: string
  disabled?: boolean
  iconSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | number
}

export default function ActionButton({
  icon: Icon,
  label,
  ariaLabel,
  onClick,
  count,
  active = false,
  layout = 'row',
  variant,
  className,
  disabled = false,
  iconSize = 'md',
}: Props) {
  const [animate, setAnimate] = React.useState(false)
  const rafRef = React.useRef<number | null>(null)
  const timeoutRef = React.useRef<number | null>(null)

  const triggerAnimation = React.useCallback(() => {
    if (typeof window === 'undefined') return
    if (rafRef.current) window.cancelAnimationFrame(rafRef.current)
    setAnimate(false)
    rafRef.current = window.requestAnimationFrame(() => setAnimate(true))
  }, [])

  React.useEffect(() => {
    if (!animate) return
    if (typeof window === 'undefined') return
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => setAnimate(false), 180)
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    }
  }, [animate])

  React.useEffect(() => {
    return () => {
      if (typeof window === 'undefined') return
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current)
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    }
  }, [])

  const handleClick = React.useCallback(() => {
    if (disabled) return
    triggerAnimation()
    onClick()
  }, [disabled, onClick, triggerAnimation])

  return (
    <button
      type="button"
      className={clsx('action-btn', className, animate && 'is-animate')}
      aria-label={ariaLabel ?? label}
      data-active={active ? 'true' : 'false'}
      data-layout={layout}
      data-variant={variant}
      onClick={handleClick}
      disabled={disabled}>
      <span className="action-icon" aria-hidden>
        <Icon size={iconSize} fill="currentColor" />
      </span>
      {typeof count === 'number' ? (
        <span className="action-count">{count.toLocaleString()}</span>
      ) : null}
    </button>
  )
}
