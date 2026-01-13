import React from 'react'
import {
  type AppBskyFeedDefs,
  type AppBskyFeedPost,
  AppBskyFeedDefs as FeedDefs,
} from '@atproto/api'

import ActionButton from '#/components/ActionButton'
import {
  Heart2_Filled_Stroke2_Corner0_Rounded as HeartFilled,
  Heart2_Stroke2_Corner0_Rounded as HeartOutline,
} from '#/components/icons/Heart2'
import {Reply as ReplyIcon} from '#/components/icons/Reply'
import {useAgent, useSession} from '#/state/session'

type CommentReaction = {liked: boolean; likeUri?: string; likeCount: number}
type CommentView = AppBskyFeedDefs.PostView & {__optimistic?: boolean}
type CommentThreadItem = {comment: CommentView; depth: number}

type Props = {
  post: AppBskyFeedDefs.PostView | null
  open?: boolean
  variant?: 'drawer' | 'detail'
  composerRef?: React.RefObject<HTMLTextAreaElement>
  onCommentCountChange?: (delta: number) => void
}

export default function PostThreadComments({
  post,
  open = true,
  variant = 'drawer',
  composerRef,
  onCommentCountChange,
}: Props) {
  const agent = useAgent()
  const {currentAccount} = useSession()
  const [replies, setReplies] = React.useState<CommentThreadItem[]>([])
  const [optimisticReplies, setOptimisticReplies] = React.useState<CommentThreadItem[]>(
    [],
  )
  const [commentReactions, setCommentReactions] = React.useState<
    Record<string, CommentReaction>
  >({})
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [text, setText] = React.useState('')
  const [replyTo, setReplyTo] = React.useState<AppBskyFeedDefs.PostView | null>(
    null,
  )

  const loadThread = React.useCallback(async () => {
    if (!post?.uri) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await agent.getPostThread({uri: post.uri, depth: 2})
      if (res.success && FeedDefs.isThreadViewPost(res.data.thread)) {
        const root = res.data.thread
        setReplies(flattenReplies(root))
      } else {
        setReplies([])
      }
    } catch (err) {
      console.error('[PostThreadComments] fetch error', err)
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setReplies([])
    } finally {
      setIsLoading(false)
    }
  }, [agent, post?.uri])

  React.useEffect(() => {
    if (!open || !post) return
    setReplyTo(null)
    setText('')
    setOptimisticReplies([])
    void loadThread()
  }, [open, post, loadThread])

  const ensureReaction = React.useCallback(
    (comment: AppBskyFeedDefs.PostView) => {
      const key = comment.uri ?? ''
      return (
        commentReactions[key] ?? {
          liked: Boolean(comment.viewer?.like),
          likeUri: comment.viewer?.like ?? undefined,
          likeCount: comment.likeCount ?? 0,
        }
      )
    },
    [commentReactions],
  )

  const toggleCommentLike = React.useCallback(
    async (comment: AppBskyFeedDefs.PostView & {__optimistic?: boolean}) => {
      if (!comment.uri || !comment.cid || comment.__optimistic) return
      const key = comment.uri
      const current = ensureReaction(comment)
      const nextLiked = !current.liked
      const nextCount = Math.max(0, current.likeCount + (nextLiked ? 1 : -1))
      setCommentReactions(prev => ({
        ...prev,
        [key]: {
          ...current,
          liked: nextLiked,
          likeCount: nextCount,
        },
      }))
      try {
        if (nextLiked) {
          const res = await agent.like(comment.uri, comment.cid)
          setCommentReactions(prev => ({
            ...prev,
            [key]: {
              ...(prev[key] ?? current),
              liked: true,
              likeUri: res.uri,
              likeCount: nextCount,
            },
          }))
        } else {
          const likeUri = current.likeUri ?? comment.viewer?.like
          if (likeUri) {
            await agent.deleteLike(likeUri)
          }
          setCommentReactions(prev => ({
            ...prev,
            [key]: {
              ...(prev[key] ?? current),
              liked: false,
              likeUri: undefined,
              likeCount: nextCount,
            },
          }))
        }
      } catch (err) {
        console.error('[PostThreadComments] like error', err)
        setCommentReactions(prev => ({...prev, [key]: current}))
      }
    },
    [agent, ensureReaction],
  )

  const postComment = React.useCallback(async () => {
    if (!post?.uri || !post.cid) return
    const body = text.trim()
    if (!body) return

    const record = post.record as AppBskyFeedPost.Record | undefined
    const rootRef = record?.reply?.root ?? {uri: post.uri, cid: post.cid}
    const parentRef =
      replyTo?.uri && replyTo?.cid
        ? {uri: replyTo.uri, cid: replyTo.cid}
        : {uri: post.uri, cid: post.cid}
    const now = new Date().toISOString()
    const tempUri = `temp:${Date.now()}`
    const optimistic: CommentView = {
      uri: tempUri,
      cid: `temp-${Date.now()}`,
      indexedAt: now,
      likeCount: 0,
      replyCount: 0,
      author: {
        did: currentAccount?.did ?? 'unknown',
        handle: currentAccount?.handle ?? 'me',
        displayName: currentAccount?.handle ?? 'Me',
      },
      record: {
        $type: 'app.bsky.feed.post',
        text: body,
        createdAt: now,
      },
      viewer: {},
      __optimistic: true,
    } as CommentView

    const optimisticItem: CommentThreadItem = {
      comment: optimistic,
      depth: replyTo ? 1 : 0,
    }

    setOptimisticReplies(prev => [optimisticItem, ...prev])
    setText('')
    setReplyTo(null)
    onCommentCountChange?.(1)

    try {
      await agent.post({
        text: body,
        reply: {
          root: rootRef,
          parent: parentRef,
        },
      })
      await loadThread()
      setOptimisticReplies(prev =>
        prev.filter(item => item.comment.uri !== tempUri),
      )
    } catch (err) {
      console.error('[PostThreadComments] post error', err)
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setOptimisticReplies(prev =>
        prev.filter(item => item.comment.uri !== tempUri),
      )
      onCommentCountChange?.(-1)
    }
  }, [agent, currentAccount, loadThread, onCommentCountChange, post, replyTo, text])

  const replyItems = React.useMemo(() => {
    const seen = new Set<string>()
    const merged: CommentThreadItem[] = []
    for (const item of optimisticReplies) {
      if (item.comment.uri) {
        seen.add(item.comment.uri)
      }
      merged.push(item)
    }
    for (const item of replies) {
      if (item.comment.uri && seen.has(item.comment.uri)) continue
      merged.push(item)
    }
    return merged
  }, [optimisticReplies, replies])

  if (!post || !open) {
    return null
  }

  return (
    <div className="post-thread-comments" data-variant={variant}>
      <div className="clips-comments-content">
        {isLoading && replyItems.length === 0 && (
          <div className="clips-comments-loading">Chargement...</div>
        )}
        {error && <div className="clips-comments-error">{error}</div>}
        {!isLoading && replyItems.length === 0 && (
          <div className="clips-comments-empty">Aucun commentaire</div>
        )}

        <div className="clips-comments-list">
          {replyItems.map(item => {
            const comment = item.comment
            const reaction = ensureReaction(comment)
            const LikeIcon = reaction.liked ? HeartFilled : HeartOutline
            const author = comment.author?.displayName || comment.author?.handle
            const handle = comment.author?.handle ?? 'unknown'
            const record = comment.record as {text?: string; createdAt?: string}
            const createdAt = comment.indexedAt || record?.createdAt
            return (
              <div
                key={comment.uri}
                className={`clips-comment${
                  comment.__optimistic ? ' is-pending' : ''
                }`}
                data-depth={item.depth}>
                <div
                  className="clips-comment-avatar"
                  style={
                    comment.author?.avatar
                      ? {backgroundImage: `url(${comment.author.avatar})`}
                      : undefined
                  }>
                  {!comment.author?.avatar &&
                    (author?.[0]?.toUpperCase() ?? '•')}
                </div>
                <div className="clips-comment-body">
                  <div className="clips-comment-meta">
                    <span className="clips-comment-author">
                      {author ?? handle}
                    </span>
                    <span className="clips-comment-handle">@{handle}</span>
                    {createdAt ? (
                      <span className="clips-comment-time">
                        {formatTimestamp(createdAt)}
                      </span>
                    ) : null}
                  </div>
                  <div className="clips-comment-text">{record?.text ?? ''}</div>
                  <div className="clips-comment-actions">
                    <ActionButton
                      layout="row"
                      variant="like"
                      label="Aimer"
                      icon={LikeIcon}
                      count={reaction.likeCount}
                      iconSize="sm"
                      active={reaction.liked}
                      onClick={() => toggleCommentLike(comment)}
                      className="comment-action"
                      disabled={comment.__optimistic}
                    />
                    <button
                      type="button"
                      className="comment-reply"
                      onClick={() => setReplyTo(comment)}
                      aria-label={`Repondre a @${handle}`}>
                      <ReplyIcon size="sm" fill="currentColor" />
                      Repondre
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="clips-comments-composer">
        {replyTo && (
          <div className="clips-comments-replying">
            Reponse a @{replyTo.author?.handle ?? 'unknown'}
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              aria-label="Annuler la reponse">
              ×
            </button>
          </div>
        )}
        <div className="clips-comments-input-row">
          <textarea
            ref={composerRef}
            className="clips-comments-input"
            placeholder="Ajouter un commentaire..."
            aria-label="Ajouter un commentaire"
            value={text}
            onChange={event => setText(event.target.value)}
            rows={1}
          />
          <button
            type="button"
            className="clips-comments-send"
            onClick={postComment}
            disabled={!text.trim()}
            aria-label="Envoyer le commentaire">
            Envoyer
          </button>
        </div>
      </div>
    </div>
  )
}

function flattenReplies(
  node: AppBskyFeedDefs.ThreadViewPost,
  depth = 0,
  maxDepth = 2,
): CommentThreadItem[] {
  if (!node?.replies?.length || depth >= maxDepth) return []
  const items: CommentThreadItem[] = []
  for (const reply of node.replies) {
    if (!FeedDefs.isThreadViewPost(reply)) continue
    items.push({comment: reply.post as CommentView, depth})
    items.push(...flattenReplies(reply, depth + 1, maxDepth))
  }
  return items
}

function formatTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('fr-FR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
