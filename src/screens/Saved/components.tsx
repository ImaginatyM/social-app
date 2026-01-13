import React from 'react'
import {type AppBskyFeedDefs} from '@atproto/api'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {
  ArrowUpDown,
  Bookmark,
  Image as ImageIcon,
  LayoutGrid,
  List as ListIcon,
  MoreHorizontal,
  Play,
  Search,
  type LucideIcon,
} from 'lucide-react'

export type MenuItem = {
  label: string
  onSelect: () => void
  icon?: LucideIcon
  destructive?: boolean
}

export function formatCount(count: number) {
  return `${count} ${count === 1 ? 'élément' : 'éléments'}`
}

export function extractPostText(post?: AppBskyFeedDefs.PostView): string {
  if (!post) return ''
  const record = post.record as {text?: string} | undefined
  return record?.text ?? ''
}

export function extractPrimaryImage(
  post?: AppBskyFeedDefs.PostView,
): string | undefined {
  if (!post?.embed) return undefined
  return extractImageFromEmbed(post.embed)
}

export function getPostType(
  post?: AppBskyFeedDefs.PostView,
): 'video' | 'image' | 'link' | 'text' {
  if (!post?.embed) return 'text'
  const type = getMediaTypeFromEmbed(post.embed)
  return type ?? 'text'
}

function extractImageFromEmbed(embed: any): string | undefined {
  if (!embed) return undefined
  if (embed.$type === 'app.bsky.embed.images#view') {
    const img = embed.images?.[0]
    return img?.thumb || img?.fullsize
  }
  if (embed.$type === 'app.bsky.embed.external#view') {
    return embed.external?.thumb || embed.external?.images?.[0]?.url
  }
  if (embed.$type === 'app.bsky.embed.recordWithMedia#view') {
    return extractImageFromEmbed(embed.media)
  }
  if (embed.$type === 'app.bsky.embed.video#view') {
    return embed.thumbnail
  }
  return undefined
}

function getMediaTypeFromEmbed(
  embed: any,
): 'video' | 'image' | 'link' | undefined {
  if (!embed) return undefined
  if (embed.$type === 'app.bsky.embed.video#view') return 'video'
  if (embed.$type === 'app.bsky.embed.images#view') return 'image'
  if (embed.$type === 'app.bsky.embed.external#view') return 'link'
  if (embed.$type === 'app.bsky.embed.recordWithMedia#view') {
    return getMediaTypeFromEmbed(embed.media)
  }
  return undefined
}

export function getCollectionPreviewImages(
  collection: {
    coverUri?: string
    itemUris: string[]
  },
  postsByUri: Record<string, AppBskyFeedDefs.PostView>,
): string[] {
  const sources: string[] = []
  if (collection.coverUri) {
    sources.push(collection.coverUri)
  }
  for (const uri of collection.itemUris) {
    if (sources.length >= 4) break
    const post = postsByUri[uri]
    const image = extractPrimaryImage(post)
    if (image && !sources.includes(image)) {
      sources.push(image)
    }
  }
  return sources
}

export function SearchBar({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <label className="saved-search">
      <Search size={16} aria-hidden={true} />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={event => onChange(event.target.value)}
        aria-label={placeholder}
      />
    </label>
  )
}

export function ViewToggle({
  value,
  onChange,
}: {
  value: 'grid' | 'list'
  onChange: (value: 'grid' | 'list') => void
}) {
  const {_} = useLingui()
  return (
    <div className="saved-toggle" role="group" aria-label={_(msg`Affichage`)}>
      <button
        type="button"
        className={value === 'grid' ? 'active' : ''}
        aria-pressed={value === 'grid'}
        onClick={() => onChange('grid')}>
        <LayoutGrid size={16} aria-hidden={true} />
        {_(msg`Grille`)}
      </button>
      <button
        type="button"
        className={value === 'list' ? 'active' : ''}
        aria-pressed={value === 'list'}
        onClick={() => onChange('list')}>
        <ListIcon size={16} aria-hidden={true} />
        {_(msg`Liste`)}
      </button>
    </div>
  )
}

export function SortMenu({
  value,
  onChange,
  options,
  label,
}: {
  value: string
  onChange: (value: string) => void
  options: {value: string; label: string}[]
  label: string
}) {
  return (
    <label className="saved-sort">
      <ArrowUpDown size={16} aria-hidden={true} />
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        aria-label={label}>
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function ContextMenu({
  items,
  label,
  align = 'right',
  icon: Icon = MoreHorizontal,
  floating = false,
}: {
  items: MenuItem[]
  label: string
  align?: 'left' | 'right'
  icon?: LucideIcon
  floating?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const containerClassName = `saved-menu${floating ? ' floating' : ''}`

  React.useEffect(() => {
    if (!open || typeof document === 'undefined') return

    const handlePointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      if (!containerRef.current?.contains(target)) {
        setOpen(false)
      }
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('touchstart', handlePointer)
    document.addEventListener('keydown', handleKey)

    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('touchstart', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <div className={containerClassName} ref={containerRef}>
      <button
        type="button"
        className="saved-icon-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={event => {
          event.stopPropagation()
          setOpen(prev => !prev)
        }}>
        <Icon size={18} aria-hidden={true} />
      </button>
      {open ? (
        <div
          className={`saved-menu-popover ${align === 'left' ? 'left' : ''}`}
          role="menu">
          {items.map(item => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={item.destructive ? 'destructive' : undefined}
              onClick={event => {
                event.stopPropagation()
                setOpen(false)
                item.onSelect()
              }}>
              {item.icon ? <item.icon size={16} aria-hidden={true} /> : null}
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon = Bookmark,
}: {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  icon?: LucideIcon
}) {
  return (
    <div className="saved-empty">
      <Icon size={36} aria-hidden={true} />
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {actionLabel && onAction ? (
        <button type="button" className="saved-button primary" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

export function LoadingSkeleton({
  variant,
  count = 6,
}: {
  variant: 'collections' | 'grid' | 'list'
  count?: number
}) {
  if (variant === 'list') {
    return (
      <div className="saved-skeleton" aria-hidden={true}>
        {Array.from({length: count}).map((_, index) => (
          <div key={index} className="saved-skeleton-row" />
        ))}
      </div>
    )
  }

  const gridClass =
    variant === 'collections' ? 'saved-skeleton-grid' : 'saved-items-grid'

  return (
    <div className={`saved-skeleton ${gridClass}`} aria-hidden={true}>
      {Array.from({length: count}).map((_, index) => (
        <div key={index} className="saved-skeleton-card" />
      ))}
    </div>
  )
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: React.ReactNode
}) {
  React.useEffect(() => {
    if (!open || typeof document === 'undefined') return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="saved-modal-backdrop" onClick={onClose}>
      <div
        className="saved-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={event => event.stopPropagation()}>
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
        {children}
      </div>
    </div>
  )
}

export function CollectionCard({
  title,
  countLabel,
  previewImages,
  onOpen,
  menuItems,
}: {
  title: string
  countLabel: string
  previewImages: string[]
  onOpen: () => void
  menuItems: MenuItem[]
}) {
  const hasSingle = previewImages.length <= 1
  const totalCells = hasSingle ? 1 : 4
  const tiles = Array.from({length: totalCells}).map((_, index) => {
    return previewImages[index]
  })

  return (
    <article className="collection-card">
      <button
        type="button"
        className="collection-link"
        onClick={onOpen}
        aria-label={title}>
        <div
          className={`collection-cover ${hasSingle ? 'single' : ''}`}
          aria-hidden={true}>
          {tiles.length > 0 ? (
            tiles.map((image, index) =>
              image ? (
                <div
                  key={`${image}-${index}`}
                  className="collection-cover-tile"
                  style={{backgroundImage: `url(${image})`}}
                />
              ) : (
                <div
                  key={`placeholder-${index}`}
                  className="collection-cover-placeholder">
                  <ImageIcon size={20} aria-hidden={true} />
                </div>
              ),
            )
          ) : (
            <div className="collection-cover-placeholder">
              <ImageIcon size={24} aria-hidden={true} />
            </div>
          )}
        </div>
        <div className="collection-body">
          <p className="collection-title">{title}</p>
          <span className="collection-count">{countLabel}</span>
        </div>
      </button>
      <ContextMenu items={menuItems} label={title} floating />
    </article>
  )
}

export function SavedItemTile({
  post,
  atUri,
  onOpen,
  menuItems,
}: {
  post?: AppBskyFeedDefs.PostView
  atUri: string
  onOpen: () => void
  menuItems: MenuItem[]
}) {
  const image = extractPrimaryImage(post)
  const text = extractPostText(post)
  const authorName = post?.author.displayName || post?.author.handle
  const handle = post?.author.handle
  const avatar = post?.author.avatar
  const type = getPostType(post)
  const isTextOnly = !image
  const menuLabel = authorName ? `Options pour ${authorName}` : 'Options'
  const {_} = useLingui()
  const openLabel = authorName
    ? `Ouvrir le post de ${authorName}`
    : 'Ouvrir le post'

  return (
    <article className={`saved-item-tile ${isTextOnly ? 'text-only' : ''}`}>
      <button
        type="button"
        className="saved-item-link"
        onClick={onOpen}
        aria-label={openLabel}>
        {image ? (
          <div className="saved-item-media">
            <img src={image} alt="" loading="lazy" />
            {type === 'video' ? (
              <div className="saved-item-overlay">
                <Play size={12} aria-hidden={true} />
                {_(msg`Vidéo`)}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="saved-item-media text-only" aria-hidden={true} />
        )}
        <div className="saved-item-body">
          <div className="saved-item-author">
            {avatar ? (
              <img
                className="saved-item-avatar"
                src={avatar}
                alt=""
                loading="lazy"
              />
            ) : (
              <div className="saved-item-avatar" />
            )}
            <div>
              {authorName || 'Post sauvegardé'}
              {handle ? <span> @{handle}</span> : null}
            </div>
          </div>
          <div className="saved-item-text">{text || atUri}</div>
        </div>
      </button>
      <div className="saved-item-actions">
        <ContextMenu items={menuItems} label={menuLabel} />
      </div>
    </article>
  )
}

export function SavedItemRow({
  post,
  atUri,
  onOpen,
  menuItems,
}: {
  post?: AppBskyFeedDefs.PostView
  atUri: string
  onOpen: () => void
  menuItems: MenuItem[]
}) {
  const image = extractPrimaryImage(post)
  const text = extractPostText(post)
  const authorName = post?.author.displayName || post?.author.handle
  const handle = post?.author.handle
  const avatar = post?.author.avatar
  const timestamp = post?.indexedAt
    ? new Date(post.indexedAt).toLocaleDateString()
    : ''
  const menuLabel = authorName ? `Options pour ${authorName}` : 'Options'
  const openLabel = authorName
    ? `Ouvrir le post de ${authorName}`
    : 'Ouvrir le post'

  return (
    <article className="saved-row">
      <button
        type="button"
        className="saved-row-link"
        onClick={onOpen}
        aria-label={openLabel}>
        {image ? (
          <img className="saved-row-thumb" src={image} alt="" loading="lazy" />
        ) : (
          <div className="saved-row-thumb" aria-hidden={true} />
        )}
        <div className="saved-row-content">
          <div className="saved-row-title">
            {avatar ? (
              <img
                className="saved-row-avatar"
                src={avatar}
                alt=""
                loading="lazy"
              />
            ) : (
              <div className="saved-row-avatar" aria-hidden={true} />
            )}
            <div>
              {authorName || 'Post sauvegardé'}
              {handle ? (
                <span className="saved-row-meta"> @{handle}</span>
              ) : null}
            </div>
          </div>
          <div className="saved-row-snippet">{text || atUri}</div>
        </div>
      </button>
      <div>
        {timestamp ? <div className="saved-row-meta">{timestamp}</div> : null}
        <ContextMenu items={menuItems} label={menuLabel} align="left" />
      </div>
    </article>
  )
}
