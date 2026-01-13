import React from 'react'
import {AtUri, type AppBskyFeedDefs} from '@atproto/api'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {ArrowLeft, ArrowRightLeft, PencilLine, Trash2} from 'lucide-react'

import * as Layout from '#/components/Layout'
import {useNavigationDeduped} from '#/lib/hooks/useNavigationDeduped'
import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {useSavedCollections} from '#/state/savedCollections'
import {useAgent} from '#/state/session'

import {
  ContextMenu,
  EmptyState,
  LoadingSkeleton,
  Modal,
  SavedItemRow,
  SavedItemTile,
  SearchBar,
  SortMenu,
  ViewToggle,
  extractPostText,
  formatCount,
  getPostType,
  type MenuItem,
} from './components'
import './savedLibrary.css'

const messages = {
  back: msg`Retour`,
  searchItems: msg`Rechercher dans la collection`,
  sortLabel: msg`Trier`,
  sortRecent: msg`Plus récents`,
  sortOldest: msg`Plus anciens`,
  sortAuthor: msg`Auteur`,
  sortType: msg`Type`,
  loading: msg`Chargement`,
  emptyTitle: msg`Aucun élément enregistré`,
  emptyDescription: msg`Enregistrez des posts pour commencer votre collection.`,
  emptyAction: msg`Explorer`,
  notFoundTitle: msg`Collection introuvable`,
  notFoundDescription: msg`Retournez à la bibliothèque pour choisir une autre collection.`,
  rename: msg`Renommer`,
  edit: msg`Modifier`,
  delete: msg`Supprimer`,
  deleteTitle: msg`Supprimer la collection`,
  deleteDescription: msg`Cette action est définitive et ne supprime pas les posts de Tellus.`,
  moveTitle: msg`Déplacer vers`,
  moveLabel: msg`Collection de destination`,
  move: msg`Déplacer`,
  remove: msg`Retirer de la collection`,
  cancel: msg`Annuler`,
  save: msg`Enregistrer`,
  searchEmptyTitle: msg`Aucun résultat`,
  searchEmptyDescription: msg`Essayez un autre terme de recherche.`,
}

type Props = NativeStackScreenProps<CommonNavigatorParams, 'BookmarksCollection'>

type SortOption = 'recent' | 'oldest' | 'author' | 'type'

type MoveDialogState = {
  uri: string
  toId: string
}

export default function CollectionDetailPage({route}: Props) {
  const {_} = useLingui()
  const navigation = useNavigationDeduped()
  const agent = useAgent()

  const ready = useSavedCollections(state => state.ready)
  const load = useSavedCollections(state => state.load)
  const persist = useSavedCollections(state => state.persist)
  const collections = useSavedCollections(state => state.collections)
  const renameCollection = useSavedCollections(state => state.rename)
  const removeCollection = useSavedCollections(state => state.remove)
  const removeItem = useSavedCollections(state => state.removeItem)
  const moveItem = useSavedCollections(state => state.moveItem)

  const {collectionId} = route.params
  const collection = collections.find(item => item.id === collectionId)
  const items = collection?.itemUris ?? []

  const [query, setQuery] = React.useState('')
  const [view, setView] = React.useState<'grid' | 'list'>('grid')
  const [sort, setSort] = React.useState<SortOption>('recent')
  const [renameDialog, setRenameDialog] = React.useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [moveDialog, setMoveDialog] = React.useState<MoveDialogState | null>(null)

  const {postsByUri, isLoadingPosts} = usePostsByUri(agent, items, ready)

  React.useEffect(() => {
    if (!ready) {
      void load()
    }
  }, [ready, load])

  const availableCollections = React.useMemo(() => {
    return collections.filter(col => col.id !== collectionId)
  }, [collections, collectionId])
  const canMove = availableCollections.length > 0

  const filteredItems = React.useMemo(() => {
    if (!query.trim()) return items
    const norm = query.trim().toLowerCase()
    return items.filter(uri => {
      const post = postsByUri[uri]
      const parts = [
        uri,
        post?.author.displayName,
        post?.author.handle,
        extractPostText(post),
      ]
      return parts
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(norm)
    })
  }, [items, postsByUri, query])

  const sortedItems = React.useMemo(() => {
    if (sort === 'recent') return filteredItems
    const indexed = filteredItems.map((uri, index) => ({uri, index}))

    const byAuthor = (uri: string) => {
      const post = postsByUri[uri]
      return (post?.author.displayName || post?.author.handle || '').toLowerCase()
    }

    const byType = (uri: string) => getPostType(postsByUri[uri])

    const sorted = indexed.sort((a, b) => {
      if (sort === 'oldest') {
        return a.index - b.index
      }
      if (sort === 'author') {
        const result = byAuthor(a.uri).localeCompare(byAuthor(b.uri))
        return result !== 0 ? result : a.index - b.index
      }
      if (sort === 'type') {
        const result = byType(a.uri).localeCompare(byType(b.uri))
        return result !== 0 ? result : a.index - b.index
      }
      return a.index - b.index
    })

    return sorted.map(item => item.uri)
  }, [filteredItems, postsByUri, sort])

  const sortOptions = React.useMemo(
    () => [
      {value: 'recent', label: _(messages.sortRecent)},
      {value: 'oldest', label: _(messages.sortOldest)},
      {value: 'author', label: _(messages.sortAuthor)},
      {value: 'type', label: _(messages.sortType)},
    ],
    [_],
  )

  const onRenameCollection = async () => {
    if (!collection || !renameDialog) return
    const trimmed = renameDialog.trim()
    if (!trimmed) return
    renameCollection(collection.id, trimmed)
    await persist()
    setRenameDialog(null)
  }

  const onDeleteCollection = async () => {
    if (!collection) return
    removeCollection(collection.id)
    await persist()
    setConfirmDelete(false)
    navigation.navigate('Bookmarks')
  }

  const onRemoveItem = async (uri: string) => {
    if (!collection) return
    removeItem(collection.id, uri)
    await persist()
  }

  const onMoveItem = async () => {
    if (!collection || !moveDialog) return
    moveItem(collection.id, moveDialog.toId, moveDialog.uri)
    await persist()
    setMoveDialog(null)
  }

  const openMoveDialog = (uri: string) => {
    if (!canMove) return
    setMoveDialog({uri, toId: availableCollections[0]?.id ?? ''})
  }

  const openPost = (post?: AppBskyFeedDefs.PostView, uri?: string) => {
    if (post) {
      const rkey = new AtUri(post.uri).rkey
      const name = post.author.handle || post.author.did
      navigation.navigate('PostThread', {name, rkey})
      return
    }
    if (uri && typeof window !== 'undefined') {
      window.open(`/#/post/${encodeURIComponent(uri)}`, '_blank')
    }
  }

  if (ready && !collection) {
    return (
      <Layout.Screen noInsetTop style={{flex: 1}}>
        <Layout.Center
          ignoreTabletLayoutOffset
          style={{
            width: '100%',
            maxWidth: 1120,
            paddingHorizontal: 0,
            paddingVertical: 0,
          }}>
          <div className="saved-library saved-page">
            <div className="saved-container">
              <EmptyState
                title={_(messages.notFoundTitle)}
                description={_(messages.notFoundDescription)}
                actionLabel={_(messages.back)}
                onAction={() => navigation.navigate('Bookmarks')}
              />
            </div>
          </div>
        </Layout.Center>
      </Layout.Screen>
    )
  }

  return (
    <Layout.Screen noInsetTop style={{flex: 1}}>
      <Layout.Center
        ignoreTabletLayoutOffset
        style={{
          width: '100%',
          maxWidth: 1120,
          paddingHorizontal: 0,
          paddingVertical: 0,
        }}>
        <div className="saved-library saved-page">
          <div className="saved-container">
            <header className="saved-header">
              <div className="saved-header-group">
                <button
                  type="button"
                  className="saved-icon-button"
                  onClick={() => navigation.navigate('Bookmarks')}
                  aria-label={_(messages.back)}>
                  <ArrowLeft size={18} aria-hidden={true} />
                </button>
                <div>
                  <h1 className="saved-title">
                    {collection?.name ??
                      (ready ? _(messages.notFoundTitle) : _(messages.loading))}
                  </h1>
                  {collection ? (
                    <p className="saved-subtitle">
                      {formatCount(collection.itemUris.length)}
                    </p>
                  ) : null}
                </div>
              </div>
              {collection ? (
                <div className="saved-header-actions">
                  <button
                    type="button"
                    className="saved-button"
                    onClick={() => setRenameDialog(collection.name)}>
                    <PencilLine size={16} aria-hidden={true} />
                    {_(messages.edit)}
                  </button>
                  <ContextMenu
                    label={collection.name}
                    items={[
                      {
                        label: _(messages.rename),
                        icon: PencilLine,
                        onSelect: () => setRenameDialog(collection.name),
                      },
                      {
                        label: _(messages.delete),
                        icon: Trash2,
                        destructive: true,
                        onSelect: () => setConfirmDelete(true),
                      },
                    ]}
                  />
                </div>
              ) : null}
            </header>

            <div className="saved-controls">
              <SearchBar
                value={query}
                onChange={setQuery}
                placeholder={_(messages.searchItems)}
              />
              <ViewToggle value={view} onChange={setView} />
              <SortMenu
                value={sort}
                onChange={value => setSort(value as SortOption)}
                options={sortOptions}
                label={_(messages.sortLabel)}
              />
            </div>

            {!ready ? (
              <LoadingSkeleton variant="grid" count={8} />
            ) : items.length === 0 ? (
              <EmptyState
                title={_(messages.emptyTitle)}
                description={_(messages.emptyDescription)}
                actionLabel={_(messages.emptyAction)}
                onAction={() => navigation.navigate('Search')}
              />
            ) : filteredItems.length === 0 ? (
              <EmptyState
                title={_(messages.searchEmptyTitle)}
                description={_(messages.searchEmptyDescription)}
              />
            ) : isLoadingPosts ? (
              <LoadingSkeleton
                variant={view === 'grid' ? 'grid' : 'list'}
                count={view === 'grid' ? 8 : 6}
              />
            ) : view === 'grid' ? (
              <div className="saved-items-grid">
                {sortedItems.map(uri => {
                  const post = postsByUri[uri]
                  const menuItems: MenuItem[] = [
                    {
                      label: _(messages.remove),
                      icon: Trash2,
                      onSelect: () => onRemoveItem(uri),
                    },
                    ...(canMove
                      ? [
                          {
                            label: _(messages.move),
                            icon: ArrowRightLeft,
                            onSelect: () => openMoveDialog(uri),
                          },
                        ]
                      : []),
                  ]

                  return (
                    <SavedItemTile
                      key={uri}
                      atUri={uri}
                      post={post}
                      onOpen={() => openPost(post, uri)}
                      menuItems={menuItems}
                    />
                  )
                })}
              </div>
            ) : (
              <div className="saved-section">
                {sortedItems.map(uri => {
                  const post = postsByUri[uri]
                  const menuItems: MenuItem[] = [
                    {
                      label: _(messages.remove),
                      icon: Trash2,
                      onSelect: () => onRemoveItem(uri),
                    },
                    ...(canMove
                      ? [
                          {
                            label: _(messages.move),
                            icon: ArrowRightLeft,
                            onSelect: () => openMoveDialog(uri),
                          },
                        ]
                      : []),
                  ]

                  return (
                    <SavedItemRow
                      key={uri}
                      atUri={uri}
                      post={post}
                      onOpen={() => openPost(post, uri)}
                      menuItems={menuItems}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </Layout.Center>

      <Modal
        open={Boolean(renameDialog)}
        title={_(messages.rename)}
        onClose={() => setRenameDialog(null)}>
        <input
          value={renameDialog ?? ''}
          onChange={event => setRenameDialog(event.target.value)}
          placeholder={collection?.name ?? ''}
          autoFocus
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void onRenameCollection()
            }
          }}
        />
        <div className="saved-modal-actions">
          <button
            type="button"
            className="saved-button ghost"
            onClick={() => setRenameDialog(null)}>
            {_(messages.cancel)}
          </button>
          <button
            type="button"
            className="saved-button primary"
            onClick={onRenameCollection}>
            {_(messages.save)}
          </button>
        </div>
      </Modal>

      <Modal
        open={confirmDelete}
        title={_(messages.deleteTitle)}
        description={_(messages.deleteDescription)}
        onClose={() => setConfirmDelete(false)}>
        <div className="saved-modal-actions">
          <button
            type="button"
            className="saved-button ghost"
            onClick={() => setConfirmDelete(false)}>
            {_(messages.cancel)}
          </button>
          <button
            type="button"
            className="saved-button danger"
            onClick={onDeleteCollection}>
            {_(messages.delete)}
          </button>
        </div>
      </Modal>

      <Modal
        open={Boolean(moveDialog)}
        title={_(messages.moveTitle)}
        onClose={() => setMoveDialog(null)}>
        <label className="saved-section">
          <span>{_(messages.moveLabel)}</span>
          <select
            value={moveDialog?.toId ?? ''}
            onChange={event =>
              setMoveDialog(prev =>
                prev ? {...prev, toId: event.target.value} : prev,
              )
            }>
            {availableCollections.map(option => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <div className="saved-modal-actions">
          <button
            type="button"
            className="saved-button ghost"
            onClick={() => setMoveDialog(null)}>
            {_(messages.cancel)}
          </button>
          <button
            type="button"
            className="saved-button primary"
            onClick={onMoveItem}
            disabled={!moveDialog?.toId}>
            {_(messages.move)}
          </button>
        </div>
      </Modal>
    </Layout.Screen>
  )
}

function usePostsByUri(
  agent: ReturnType<typeof useAgent>,
  uris: string[],
  enabled: boolean,
) {
  const [postsByUri, setPostsByUri] = React.useState<
    Record<string, AppBskyFeedDefs.PostView>
  >({})
  const [isLoadingPosts, setIsLoadingPosts] = React.useState(false)

  const uriKey = React.useMemo(() => uris.join('|'), [uris])

  React.useEffect(() => {
    if (!enabled || uris.length === 0) {
      setPostsByUri({})
      setIsLoadingPosts(false)
      return
    }

    let cancelled = false

    const fetchPosts = async () => {
      setIsLoadingPosts(true)
      try {
        const next: Record<string, AppBskyFeedDefs.PostView> = {}
        for (let i = 0; i < uris.length; i += 25) {
          const chunk = uris.slice(i, i + 25)
          const res = await agent.app.bsky.feed.getPosts({uris: chunk})
          for (const post of res.data.posts) {
            next[post.uri] = post
          }
        }
        if (!cancelled) {
          setPostsByUri(next)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[SavedCollections] failed to load posts', error)
          setPostsByUri({})
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPosts(false)
        }
      }
    }

    void fetchPosts()

    return () => {
      cancelled = true
    }
  }, [agent, enabled, uriKey, uris.length])

  return {postsByUri, isLoadingPosts}
}
