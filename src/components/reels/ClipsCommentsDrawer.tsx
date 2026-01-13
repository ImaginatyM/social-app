import React from 'react'
import {createPortal} from 'react-dom'
import {type AppBskyFeedDefs} from '@atproto/api'

import PostThreadComments from '#/components/comments/PostThreadComments'

type Props = {
  open: boolean
  post: AppBskyFeedDefs.PostView | null
  onClose: () => void
  onCommentCountChange?: (delta: number) => void
}

export default function ClipsCommentsDrawer({
  open,
  post,
  onClose,
  onCommentCountChange,
}: Props) {
  const portalRoot = React.useMemo(() => {
    if (typeof document === 'undefined') return null
    const existing = document.getElementById('clips-comments-drawer-root')
    if (existing) return existing
    const node = document.createElement('div')
    node.id = 'clips-comments-drawer-root'
    document.body.appendChild(node)
    return node
  }, [])

  React.useEffect(() => {
    if (!open || typeof document === 'undefined') return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !post || !portalRoot) {
    return null
  }

  const authorName = post.author?.displayName || post.author?.handle || 'Auteur'
  const authorHandle = post.author?.handle
  const profileHref = authorHandle ? `/profile/${authorHandle}` : undefined

  return createPortal(
    <div className="clips-comments-overlay" role="dialog" aria-modal="true">
      <div className="clips-comments-sheet" role="document">
        <div className="clips-comments-header">
          <div
            className="clips-comments-avatar"
            style={
              post.author?.avatar
                ? {backgroundImage: `url(${post.author.avatar})`}
                : undefined
            }>
            {!post.author?.avatar && (authorName[0]?.toUpperCase() ?? '•')}
          </div>
          <div className="clips-comments-title">
            {profileHref ? (
              <a className="clips-comments-author" href={profileHref}>
                {authorName}
              </a>
            ) : (
              <span className="clips-comments-author">{authorName}</span>
            )}
            <span className="clips-comments-handle">
              @{authorHandle ?? 'unknown'}
            </span>
          </div>
          <button
            type="button"
            className="clips-comments-close"
            onClick={onClose}
            aria-label="Fermer les commentaires">
            ×
          </button>
        </div>

        <PostThreadComments
          post={post}
          open={open}
          variant="drawer"
          onCommentCountChange={onCommentCountChange}
        />
      </div>
      <button
        type="button"
        className="clips-comments-backdrop"
        onClick={onClose}
        aria-label="Fermer les commentaires"
      />
    </div>,
    portalRoot,
  )
}
