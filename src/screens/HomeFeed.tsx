import React from 'react'
import clsx from 'clsx'
import type {AppBskyFeedDefs} from '@atproto/api'

import PostActions from '../components/PostActions'
import SaveToCollectionSheet from '../components/SaveToCollectionSheet'
import PostDetailModal from '../components/feed/PostDetailModal'
import VideoReel from '../components/VideoReel'
import ClipsCommentsDrawer from '../components/reels/ClipsCommentsDrawer'
import {useSavedCollections} from '../state/savedCollections'
import {useAgent} from '../state/session'
import {type FeedDescriptor} from '../state/queries/post-feed'
import {type SavedFeedSourceInfo} from '../state/queries/feed'
import {getPostImages, getCounts} from '../lib/feed/mediaHelpers'
import {getPrimaryMedia, hasVideo} from '../lib/media'

const PAGE_SIZE = 30

type ReactionState = {liked: boolean; saved: boolean; likeUri?: string}
type CountState = {likes: number; comments: number}

type ActiveSaveState = {key: string; uri: string; fallback: ReactionState}
type ActiveCommentsState = {
  key: string
  post: AppBskyFeedDefs.PostView
  counts: CountState
}

type LayoutMode = 'gallery' | 'tiktok'

type HomeFeedProps = {
  feedDescriptor: FeedDescriptor
  feedInfo?: SavedFeedSourceInfo
  layout: LayoutMode
}

export default function HomeFeed({feedDescriptor, feedInfo, layout}: HomeFeedProps) {
  const agent = useAgent()
  const [feedItems, setFeedItems] = React.useState<AppBskyFeedDefs.FeedViewPost[]>([])
  const [userReactions, setUserReactions] = React.useState<Record<string, ReactionState>>({})
  const [countsByKey, setCountsByKey] = React.useState<Record<string, CountState>>({})
  const [selectedPost, setSelectedPost] = React.useState<AppBskyFeedDefs.PostView | null>(null)
  const [isDetailOpen, setDetailOpen] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [activeSave, setActiveSave] = React.useState<ActiveSaveState | null>(null)
  const [activeComments, setActiveComments] = React.useState<ActiveCommentsState | null>(null)

  const cursorRef = React.useRef<string | undefined>()
  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const snapTimeoutRef = React.useRef<number | null>(null)
  const visibleMapRef = React.useRef<Map<Element, number>>(new Map())
  const observerRef = React.useRef<IntersectionObserver | null>(null)

  const posts = React.useMemo(() => {
    return feedItems
      .map(item => item.post)
      .filter((post): post is AppBskyFeedDefs.PostView => Boolean(post))
  }, [feedItems])

  const hasMore = Boolean(cursorRef.current)

  const ensureReaction = React.useCallback(
    (post: AppBskyFeedDefs.PostView, key: string) => {
      return (
        userReactions[key] ?? {
          liked: Boolean(post.viewer?.like),
          likeUri: post.viewer?.like ?? undefined,
          saved: Boolean(post.viewer?.bookmarked),
        }
      )
    },
    [userReactions],
  )

  const updateReaction = React.useCallback(
    (
      key: string,
      fallback: ReactionState,
      updater: (current: ReactionState) => ReactionState,
    ) => {
      setUserReactions(prev => {
        const current = prev[key] ?? fallback
        const next = updater(current)
        return {...prev, [key]: next}
      })
    },
    [],
  )

  const updateCounts = React.useCallback(
    (
      key: string,
      fallback: CountState,
      updater: (current: CountState) => CountState,
    ) => {
      setCountsByKey(prev => {
        const current = prev[key] ?? fallback
        const next = updater(current)
        return {...prev, [key]: next}
      })
    },
    [],
  )

  const fetchFeed = React.useCallback(
    async (cursor?: string): Promise<{feed: AppBskyFeedDefs.FeedViewPost[]; cursor?: string}> => {
      try {
        if (feedDescriptor === 'following') {
          const res = await agent.getTimeline({cursor, limit: PAGE_SIZE})
          if (res.success) {
            return {feed: res.data.feed ?? [], cursor: res.data.cursor}
          }
          return {feed: [], cursor: undefined}
        }

        const descriptorParts = feedDescriptor.split('|')
        const descriptorType = descriptorParts[0]
        const descriptorUri = descriptorParts[1] ?? feedInfo?.uri

        if (descriptorType === 'list' && descriptorUri) {
          const res = await agent.app.bsky.feed.getListFeed({
            list: descriptorUri,
            cursor,
            limit: PAGE_SIZE,
          })
          return {
            feed: res.data.feed ?? [],
            cursor: res.data.cursor ?? undefined,
          }
        }

        const feedUri = descriptorUri ?? feedInfo?.uri
        if (!feedUri) {
          return {feed: [], cursor: undefined}
        }

        const res = await agent.app.bsky.feed.getFeed({
          feed: feedUri,
          cursor,
          limit: PAGE_SIZE,
        })
        return {
          feed: res.data.feed ?? [],
          cursor: res.data.cursor ?? undefined,
        }
      } catch (err) {
        console.error('[HomeFeed] fetch error', err)
        throw err
      }
    },
    [agent, feedDescriptor, feedInfo?.uri],
  )

  React.useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    cursorRef.current = undefined
    fetchFeed()
      .then(({feed, cursor}) => {
        if (cancelled) return
        setFeedItems(feed)
        cursorRef.current = cursor
      })
      .catch(err => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
        setFeedItems([])
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [fetchFeed])

  const loadMore = React.useCallback(async () => {
    const cursor = cursorRef.current
    if (!cursor) return
    try {
      const {feed, cursor: nextCursor} = await fetchFeed(cursor)
      setFeedItems(prev => [...prev, ...feed])
      cursorRef.current = nextCursor
    } catch (err) {
      console.error('[HomeFeed] pagination error', err)
    }
  }, [fetchFeed])

  const handleScrollSnap = React.useCallback(() => {
    if (typeof window === 'undefined') return
    const container = scrollRef.current
    if (!container) return
    if (snapTimeoutRef.current) window.clearTimeout(snapTimeoutRef.current)
    snapTimeoutRef.current = window.setTimeout(() => {
      const visibleMap = visibleMapRef.current
      let target: HTMLElement | null = null
      let maxRatio = 0
      visibleMap.forEach((ratio, element) => {
        if (ratio > maxRatio) {
          maxRatio = ratio
          target = element as HTMLElement
        }
      })
      if (target) {
        const top = getOffsetTop(target, container)
        container.scrollTo({top, behavior: 'smooth'})
        return
      }
      const height = container.clientHeight || 1
      const nextIndex = Math.round(container.scrollTop / height)
      const nextTop = nextIndex * height
      if (Math.abs(container.scrollTop - nextTop) > 2) {
        container.scrollTo({top: nextTop, behavior: 'smooth'})
      }
    }, 150)
  }, [])

  React.useEffect(() => {
    if (layout !== 'tiktok') return
    const container = scrollRef.current
    if (!container || typeof IntersectionObserver === 'undefined') return

    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }

    const visibleMap = new Map<Element, number>()
    visibleMapRef.current = visibleMap
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          visibleMap.set(entry.target, entry.intersectionRatio)
        })
      },
      {
        root: container,
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    )

    const items = container.querySelectorAll<HTMLElement>('[data-clip-item="true"]')
    items.forEach(item => observer.observe(item))
    observerRef.current = observer

    return () => {
      observer.disconnect()
      observerRef.current = null
      visibleMap.clear()
    }
  }, [layout, feedItems.length])

  React.useEffect(() => {
    return () => {
      if (typeof window === 'undefined') return
      if (snapTimeoutRef.current) window.clearTimeout(snapTimeoutRef.current)
    }
  }, [])

  const openDetail = React.useCallback((post: AppBskyFeedDefs.PostView) => {
    setSelectedPost(post)
    setDetailOpen(true)
  }, [])

  const closeDetail = React.useCallback(() => {
    setDetailOpen(false)
    setSelectedPost(null)
  }, [])

  const closeComments = React.useCallback(() => {
    setActiveComments(null)
  }, [])

  const handleCommentCountChange = React.useCallback(
    (delta: number) => {
      if (!activeComments) return
      updateCounts(activeComments.key, activeComments.counts, current => ({
        ...current,
        comments: Math.max(0, current.comments + delta),
      }))
    },
    [activeComments, updateCounts],
  )

  const handleCloseSaveSheet = React.useCallback(() => {
    setActiveSave(prev => {
      if (prev) {
        const membership = useSavedCollections.getState().contains(prev.uri).inAny
        updateReaction(prev.key, prev.fallback, current => ({
          ...current,
          saved: membership,
        }))
      }
      return null
    })
  }, [updateReaction])

  const toggleLike = React.useCallback(
    async (
      post: AppBskyFeedDefs.PostView,
      key: string,
      reaction: ReactionState,
      counts: CountState,
    ) => {
      if (!post.uri || !post.cid) return
      const previousReaction = reaction
      const previousCounts = counts
      const nextLiked = !reaction.liked

      updateReaction(key, reaction, current => ({
        ...current,
        liked: nextLiked,
        likeUri: nextLiked ? current.likeUri : undefined,
      }))
      updateCounts(key, counts, current => ({
        ...current,
        likes: Math.max(0, current.likes + (nextLiked ? 1 : -1)),
      }))

      try {
        if (nextLiked) {
          const res = await agent.like(post.uri, post.cid)
          setUserReactions(prev => ({
            ...prev,
            [key]: {
              ...(prev[key] ?? reaction),
              liked: true,
              likeUri: res.uri,
            },
          }))
        } else {
          const likeUri = reaction.likeUri ?? post.viewer?.like
          if (likeUri) {
            await agent.deleteLike(likeUri)
          }
          setUserReactions(prev => ({
            ...prev,
            [key]: {
              ...(prev[key] ?? reaction),
              liked: false,
              likeUri: undefined,
            },
          }))
        }
      } catch (err) {
        console.error('[HomeFeed] like error', err)
        setUserReactions(prev => ({...prev, [key]: previousReaction}))
        setCountsByKey(prev => ({...prev, [key]: previousCounts}))
      }
    },
    [agent, updateCounts, updateReaction],
  )

  const sharePost = React.useCallback((post: AppBskyFeedDefs.PostView) => {
    const url = `https://tellus.app/profile/${post.author?.handle}/post/${post.uri.split('/').pop()}`
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({url}).catch(() => {
        if (typeof window !== 'undefined') window.open(url, '_blank')
      })
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {})
    } else if (typeof window !== 'undefined') {
      window.open(url, '_blank')
    }
  }, [])

  const renderPost = React.useCallback(
    (post: AppBskyFeedDefs.PostView, index: number) => {
      const key = post.uri ?? `post-${index}`
      const baseReaction = ensureReaction(post, key)
      const reaction = userReactions[key] ?? baseReaction
      const countsRaw = getCounts(post as any)
      const countsFromPost: CountState = {
        likes: countsRaw.like ?? post.likeCount ?? 0,
        comments: countsRaw.comment ?? post.replyCount ?? 0,
      }
      const counts = countsByKey[key] ?? countsFromPost

      const record = post.record as {text?: string} | undefined
      const text = record?.text ?? ''
      const authorName = post.author?.displayName || post.author?.handle || 'Inconnu'
      const authorHandle = post.author?.handle
      const createdAt = post.indexedAt ? new Date(post.indexedAt) : null
      const images = getPostImages(post)

      const onLike = () => toggleLike(post, key, reaction, counts)
      const onSave = () => {
        if (!post.uri) return
        setActiveSave({key, uri: post.uri, fallback: reaction})
      }
      const onComment = () => openDetail(post)
      const onShare = () => sharePost(post)

      if (layout === 'gallery') {
        if (images.length === 0) {
          return null
        }
        return (
          <InstagramPostCard
            key={key}
            authorName={authorName}
            authorHandle={authorHandle}
            avatarUrl={post.author?.avatar ?? undefined}
            createdAt={createdAt}
            images={images}
            text={text}
            reaction={reaction}
            counts={counts}
            onLike={onLike}
            onSave={onSave}
            onComment={onComment}
            onShare={onShare}
            onOpen={() => openDetail(post)}
          />
        )
      }

      return null
    },
    [
      countsByKey,
      ensureReaction,
      layout,
      openDetail,
      sharePost,
      setActiveSave,
      toggleLike,
      updateReaction,
      userReactions,
    ],
  )

  const renderReelsLayout = React.useCallback(() => {
    const items = feedItems

    const collectVideoUrl = (post: any): string | undefined => {
      const v =
        post?.embed?.video ||
        post?.record?.embed?.video ||
        post?.embed?.media?.video
      if (!v) return undefined
      return typeof v === 'string' ? v : (v?.src || v?.url)
    }

    const reelItems = items.filter(item => {
      const post = item?.post ?? item
      return hasVideo(post) || typeof collectVideoUrl(post) === 'string'
    })

    if (isLoading && reelItems.length === 0)
      return <div className="home-feed-loading">Chargement…</div>
    if (reelItems.length === 0) {
      return (
        <div
          className="home-feed-stream layout-tiktok"
          style={{padding: 24, textAlign: 'center'}}>
          Aucune vidéo trouvée dans ce feed.
        </div>
      )
    }

    return (
      <div
        className="home-feed-scroll clipsScroller"
        data-feed-scroll=""
        ref={scrollRef}
        onScroll={handleScrollSnap}>
        {reelItems.map((item: any, index: number) => {
          const post = item.post ?? item
          if (!post) return null
          const key = post.uri ?? item.uri ?? `reel-${index}`

          const baseReaction = ensureReaction(post, key)
          const reaction = userReactions[key] ?? baseReaction
          const countsRaw = getCounts(post as any)
          const countsFromPost: CountState = {
            likes: countsRaw.like ?? post.likeCount ?? 0,
            comments: countsRaw.comment ?? post.replyCount ?? 0,
          }
          const counts = countsByKey[key] ?? countsFromPost

          const media = getPrimaryMedia(item)
          const mediaUrl =
            collectVideoUrl(post) ??
            (media?.type === 'video' ? media.url : undefined)
          if (!mediaUrl) return null
          const imagePreview =
            (media?.type === 'video' ? media.poster : undefined) ??
            (media?.type === 'image' ? media.url : undefined)

          const onLike = () => toggleLike(post, key, reaction, counts)
          const onSave = () => {
            if (!post.uri) return
            setActiveSave({key, uri: post.uri, fallback: reaction})
          }
          const onComment = () => setActiveComments({key, post, counts})
          const onShare = () => sharePost(post)

          return (
            <section
              key={key}
              className="reel-slide clipItem"
              data-clip-item="true">
              <div className="reel-stage clipStage">
                <VideoReel className="reel-video" src={mediaUrl} poster={imagePreview} />
                <div className="reel-actions">
                  <PostActions
                    layout="tiktok"
                    onLike={onLike}
                    onComment={onComment}
                    onSave={onSave}
                    onShare={onShare}
                    liked={reaction.liked}
                    saved={reaction.saved}
                    counts={counts}
                  />
                </div>
              </div>
            </section>
          )
        })}
        {hasMore && (
          <section
            className="reel-slide clipItem load-more-slide"
            data-clip-item="true">
            <button className="reels-load-more" onClick={loadMore}>
              Charger plus
            </button>
          </section>
        )}
      </div>
    )
  }, [
    countsByKey,
    ensureReaction,
    feedItems,
    handleScrollSnap,
    hasMore,
    isLoading,
    loadMore,
    setActiveSave,
    setActiveComments,
    sharePost,
    toggleLike,
    userReactions,
  ])

  const detailKey = selectedPost?.uri ?? 'detail'

  return (
    <div style={{flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0}}>
      <div className={clsx('home-feed-wrapper', `layout-${layout}`)}>
        {error && <div className="home-feed-error">Erreur de chargement : {error}</div>}

        {layout === 'tiktok'
          ? renderReelsLayout()
          : isLoading && posts.length === 0
            ? <div className="home-feed-loading">Chargement…</div>
            : (
              <div className={clsx('home-feed-stream', `layout-${layout}`)} data-feed-scroll="">
                {posts.map((post, index) => renderPost(post, index))}
              </div>
            )}

        {hasMore && layout !== 'tiktok' && (
          <div className="home-feed-more">
            <button onClick={loadMore}>Charger plus</button>
          </div>
        )}
      </div>

      <PostDetailModal
        open={isDetailOpen}
        post={selectedPost}
        reaction={selectedPost ? ensureReaction(selectedPost, detailKey) : null}
        counts={
          selectedPost
            ? countsByKey[detailKey] ?? {
                likes: getCounts(selectedPost as any).like ?? selectedPost.likeCount ?? 0,
                comments: getCounts(selectedPost as any).comment ?? selectedPost.replyCount ?? 0,
              }
            : null
        }
        onLike={() => {
          if (!selectedPost) return
          const baseReaction = ensureReaction(selectedPost, detailKey)
          const reaction = userReactions[detailKey] ?? baseReaction
          const countsRaw = getCounts(selectedPost as any)
          const baseCounts: CountState = {
            likes: countsRaw.like ?? selectedPost.likeCount ?? 0,
            comments: countsRaw.comment ?? selectedPost.replyCount ?? 0,
          }
          const counts = countsByKey[detailKey] ?? baseCounts
          void toggleLike(selectedPost, detailKey, reaction, counts)
        }}
        onSave={() => {
          if (!selectedPost?.uri) return
          const fallback = ensureReaction(selectedPost, detailKey)
          setActiveSave({key: detailKey, uri: selectedPost.uri, fallback})
        }}
        onShare={() => {
          if (!selectedPost) return
          sharePost(selectedPost)
        }}
        onCommentCountChange={delta => {
          if (!selectedPost) return
          const countsRaw = getCounts(selectedPost as any)
          const baseCounts: CountState = {
            likes: countsRaw.like ?? selectedPost.likeCount ?? 0,
            comments: countsRaw.comment ?? selectedPost.replyCount ?? 0,
          }
          updateCounts(detailKey, baseCounts, current => ({
            ...current,
            comments: Math.max(0, current.comments + delta),
          }))
        }}
        onClose={closeDetail}
      />
      <ClipsCommentsDrawer
        open={Boolean(activeComments)}
        post={activeComments?.post ?? null}
        onClose={closeComments}
        onCommentCountChange={handleCommentCountChange}
      />
      {activeSave && (
        <SaveToCollectionSheet
          atUri={activeSave.uri}
          onClose={handleCloseSaveSheet}
        />
      )}
    </div>
  )
}

function InstagramPostCard({
  authorName,
  authorHandle,
  avatarUrl,
  createdAt,
  images,
  text,
  reaction,
  counts,
  onLike,
  onSave,
  onComment,
  onShare,
  onOpen,
}: InstagramPostCardProps) {
  const [index, setIndex] = React.useState(0)
  const current = images[index]
  const hasMultiple = images.length > 1

  const handlePrev = (event: React.MouseEvent) => {
    event.stopPropagation()
    setIndex(prev => (prev - 1 + images.length) % images.length)
  }

  const handleNext = (event: React.MouseEvent) => {
    event.stopPropagation()
    setIndex(prev => (prev + 1) % images.length)
  }

  return (
    <article className="insta-card" onClick={onOpen}>
      <div className="insta-header">
        <div
          className="insta-avatar"
          style={avatarUrl ? {backgroundImage: `url(${avatarUrl})`} : undefined}>
          {!avatarUrl && (authorName[0]?.toUpperCase() ?? '•')}
        </div>
        <div className="insta-header-text">
          <span>{authorName}</span>
          <small>@{authorHandle ?? '—'}</small>
        </div>
        {createdAt && (
          <span className="insta-timestamp">{createdAt.toLocaleString()}</span>
        )}
      </div>
      <div className="insta-media">
        <img src={current.url} alt="" loading="lazy" />
        {hasMultiple && (
          <>
            <button className="insta-nav prev" onClick={handlePrev} aria-label="Image précédente">
              ‹
            </button>
            <button className="insta-nav next" onClick={handleNext} aria-label="Image suivante">
              ›
            </button>
            <div className="insta-pagination">
              {index + 1} / {images.length}
            </div>
          </>
        )}
      </div>
      <div className="insta-actions" onClick={event => event.stopPropagation()}>
        <PostActions
          layout="gallery"
          onLike={onLike}
          onComment={onComment}
          onSave={onSave}
          onShare={onShare}
          liked={reaction.liked}
          saved={reaction.saved}
          counts={counts}
        />
      </div>
      {text && <div className="insta-caption">{text}</div>}
    </article>
  )
}

function getOffsetTop(target: HTMLElement, container: HTMLElement) {
  const targetRect = target.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  return targetRect.top - containerRect.top + container.scrollTop
}
