import React, {useEffect, useMemo, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import type {AppBskyFeedDefs} from '@atproto/api'

import PostActions from '#/components/PostActions'
import PostThreadComments from '#/components/comments/PostThreadComments'
import {getPostImages, getPostVideo, getCounts} from '../../lib/feed/mediaHelpers'

type ReactionState = {liked: boolean; saved: boolean}
type CountState = {likes: number; comments: number}

type Props = {
  open: boolean
  post: AppBskyFeedDefs.PostView | null
  reaction?: ReactionState | null
  counts?: CountState | null
  onLike: () => void
  onSave: () => void
  onShare: () => void
  onClose: () => void
  onCommentCountChange?: (delta: number) => void
}

export default function PostDetailModal({
  open,
  post,
  reaction,
  counts,
  onLike,
  onSave,
  onShare,
  onClose,
  onCommentCountChange,
}: Props) {
  const [index, setIndex] = useState(0)
  const composerRef = useRef<HTMLTextAreaElement>(null)

  const portalRoot = useMemo(() => {
    if (typeof document === 'undefined') return null
    const existing = document.getElementById('post-detail-modal-root')
    if (existing) return existing
    const node = document.createElement('div')
    node.id = 'post-detail-modal-root'
    document.body.appendChild(node)
    return node
  }, [])

  useEffect(() => {
    if (open) {
      setIndex(0)
    }
  }, [open, post])

  useEffect(() => {
    if (!open || typeof document === 'undefined') return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  useEffect(() => {
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

  const images = getPostImages(post)
  const video = getPostVideo(post)
  const currentImage = images[index] ?? null

  const record = post.record as {text?: string} | undefined
  const text = record?.text || post?.text || ''

  const countsRaw = getCounts(post as any)
  const fallbackCounts: CountState = {
    likes: countsRaw.like ?? post.likeCount ?? 0,
    comments: countsRaw.comment ?? post.replyCount ?? 0,
  }
  const derivedCounts = counts ?? fallbackCounts
  const derivedReaction: ReactionState = reaction ?? {
    liked: Boolean(post.viewer?.like),
    saved: Boolean(post.viewer?.bookmarked),
  }

  const authorName = post.author?.displayName || post.author?.handle || 'Auteur'
  const authorHandle = post.author?.handle
  const profileHref = authorHandle ? `/profile/${authorHandle}` : undefined

  const handleCommentFocus = () => {
    composerRef.current?.focus()
  }

  return createPortal(
    <div
      className="post-detail-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}>
      <div
        className="post-detail-card"
        role="document"
        onClick={event => event.stopPropagation()}>
        <div className="post-detail-media">
          {currentImage ? (
            <img src={currentImage.url} alt="" loading="lazy" />
          ) : video ? (
            <video
              src={video.url}
              poster={video.thumb}
              controls
              playsInline
            />
          ) : null}

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setIndex(x => Math.max(0, x - 1))}
                className="post-detail-nav prev"
                aria-label="Image precedente">
                ‹
              </button>
              <button
                type="button"
                onClick={() => setIndex(x => Math.min(images.length - 1, x + 1))}
                className="post-detail-nav next"
                aria-label="Image suivante">
                ›
              </button>
              <div className="post-detail-pagination">
                {index + 1} / {images.length}
              </div>
            </>
          )}
        </div>

        <div className="post-detail-sidebar">
          <div className="post-detail-header">
            {profileHref ? (
              <a className="post-detail-author" href={profileHref}>
                <div
                  className="post-detail-avatar"
                  style={
                    post.author?.avatar
                      ? {backgroundImage: `url(${post.author.avatar})`}
                      : undefined
                  }>
                  {!post.author?.avatar &&
                    (authorName[0]?.toUpperCase() ?? '•')}
                </div>
                <div className="post-detail-author-text">
                  <span className="post-detail-name">{authorName}</span>
                  <span className="post-detail-handle">
                    @{authorHandle ?? 'unknown'}
                  </span>
                </div>
              </a>
            ) : (
              <div className="post-detail-author">
                <div className="post-detail-avatar">
                  {authorName[0]?.toUpperCase() ?? '•'}
                </div>
                <div className="post-detail-author-text">
                  <span className="post-detail-name">{authorName}</span>
                  <span className="post-detail-handle">@unknown</span>
                </div>
              </div>
            )}
            {post.indexedAt && (
              <span className="post-detail-time">
                {new Date(post.indexedAt).toLocaleString()}
              </span>
            )}
          </div>

          <div className="post-detail-body">
            {text && <div className="post-detail-caption">{text}</div>}
            <div className="post-detail-actions">
              <PostActions
                layout="gallery"
                onLike={onLike}
                onComment={handleCommentFocus}
                onSave={onSave}
                onShare={onShare}
                liked={derivedReaction.liked}
                saved={derivedReaction.saved}
                counts={derivedCounts}
              />
            </div>
            <PostThreadComments
              post={post}
              open={open}
              variant="detail"
              composerRef={composerRef}
              onCommentCountChange={onCommentCountChange}
            />
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="post-detail-close"
        aria-label="Fermer le post">
        ×
      </button>
    </div>,
    portalRoot,
  )
}
