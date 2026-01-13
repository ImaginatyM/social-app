import React from 'react'
import {type AppBskyFeedDefs} from '@atproto/api'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {Image as ImageIcon, PencilLine, Plus, Trash2} from 'lucide-react'

import * as Layout from '#/components/Layout'
import {useNavigationDeduped} from '#/lib/hooks/useNavigationDeduped'
import {useSavedCollections} from '#/state/savedCollections'
import {useAgent} from '#/state/session'

import {
  CollectionCard,
  EmptyState,
  LoadingSkeleton,
  Modal,
  SearchBar,
  SortMenu,
  formatCount,
  getCollectionPreviewImages,
  type MenuItem,
} from './components'
import './savedLibrary.css'

const messages = {
  title: msg`Conservés`,
  subtitle: msg`Vos collections, dans un espace calme et organisé.`,
  newCollection: msg`Nouvelle collection`,
  searchCollections: msg`Rechercher une collection`,
  sortLabel: msg`Trier`,
  sortRecent: msg`Récentes`,
  sortName: msg`Nom`,
  sortCount: msg`Nombre d'éléments`,
  emptyTitle: msg`Aucune collection pour l'instant`,
  emptyDescription: msg`Commencez par enregistrer des posts pour les retrouver ici.`,
  searchEmptyTitle: msg`Aucune collection trouvée`,
  searchEmptyDescription: msg`Essayez un autre terme de recherche.`,
  emptyAction: msg`Créer une collection`,
  renameTitle: msg`Renommer la collection`,
  createTitle: msg`Nouvelle collection`,
  deleteTitle: msg`Supprimer la collection`,
  deleteDescription: msg`Les posts ne seront pas supprimés de Tellus.`,
  coverTitle: msg`Modifier la couverture`,
  coverDescription: msg`Ajoutez une URL d'image pour personnaliser la collection.`,
  cancel: msg`Annuler`,
  save: msg`Enregistrer`,
  create: msg`Créer`,
  delete: msg`Supprimer`,
  coverPlaceholder: msg`URL de la couverture`,
  rename: msg`Renommer`,
  updateCover: msg`Modifier la couverture`,
}

type SortOption = 'recent' | 'name' | 'count'

export default function SavedCollectionsPage() {
  const {_} = useLingui()
  const agent = useAgent()
  const navigation = useNavigationDeduped()

  const ready = useSavedCollections(state => state.ready)
  const load = useSavedCollections(state => state.load)
  const persist = useSavedCollections(state => state.persist)
  const ensureDefault = useSavedCollections(state => state.ensureDefault)
  const collections = useSavedCollections(state => state.collections)
  const createCollection = useSavedCollections(state => state.create)
  const renameCollection = useSavedCollections(state => state.rename)
  const removeCollection = useSavedCollections(state => state.remove)
  const updateCover = useSavedCollections(state => state.updateCover)

  const [query, setQuery] = React.useState('')
  const [sort, setSort] = React.useState<SortOption>('recent')
  const [nameDialog, setNameDialog] = React.useState<{
    mode: 'create' | 'rename'
    id?: string
    name: string
  } | null>(null)
  const [confirmDelete, setConfirmDelete] = React.useState<{
    id: string
    name: string
  } | null>(null)
  const [coverDialog, setCoverDialog] = React.useState<{
    id: string
    value: string
  } | null>(null)

  const [postsByUri, setPostsByUri] = React.useState<
    Record<string, AppBskyFeedDefs.PostView>
  >({})

  React.useEffect(() => {
    if (!ready) {
      void load()
    }
  }, [ready, load])

  React.useEffect(() => {
    if (ready && collections.length === 0) {
      ensureDefault()
      void persist()
    }
  }, [ready, collections.length, ensureDefault, persist])

  const previewUris = React.useMemo(() => {
    const unique = new Set<string>()
    for (const collection of collections) {
      for (const uri of collection.itemUris.slice(0, 4)) {
        unique.add(uri)
      }
    }
    return Array.from(unique)
  }, [collections])

  React.useEffect(() => {
    if (!ready || previewUris.length === 0) {
      setPostsByUri({})
      return
    }

    let cancelled = false

    const fetchPreviewPosts = async () => {
      try {
        const next: Record<string, AppBskyFeedDefs.PostView> = {}
        for (let i = 0; i < previewUris.length; i += 25) {
          const chunk = previewUris.slice(i, i + 25)
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
          console.error('[SavedCollections] preview fetch failed', error)
          setPostsByUri({})
        }
      }
    }

    void fetchPreviewPosts()

    return () => {
      cancelled = true
    }
  }, [agent, previewUris, ready])

  const filteredCollections = React.useMemo(() => {
    if (!query.trim()) return collections
    const norm = query.trim().toLowerCase()
    return collections.filter(collection =>
      collection.name.toLowerCase().includes(norm),
    )
  }, [collections, query])

  const sortedCollections = React.useMemo(() => {
    const list = [...filteredCollections]
    if (sort === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sort === 'count') {
      list.sort((a, b) => b.itemUris.length - a.itemUris.length)
    } else {
      list.sort((a, b) => b.updatedAt - a.updatedAt)
    }
    return list
  }, [filteredCollections, sort])

  const sortOptions = React.useMemo(
    () => [
      {value: 'recent', label: _(messages.sortRecent)},
      {value: 'name', label: _(messages.sortName)},
      {value: 'count', label: _(messages.sortCount)},
    ],
    [_],
  )

  const onSubmitName = async () => {
    if (!nameDialog) return
    const trimmed = nameDialog.name.trim()

    if (nameDialog.mode === 'create') {
      const name = trimmed || _(messages.newCollection)
      createCollection(name)
    } else if (nameDialog.id) {
      if (!trimmed) return
      renameCollection(nameDialog.id, trimmed)
    }
    await persist()
    setNameDialog(null)
  }

  const onConfirmDelete = async () => {
    if (!confirmDelete) return
    removeCollection(confirmDelete.id)
    await persist()
    setConfirmDelete(null)
  }

  const onSaveCover = async () => {
    if (!coverDialog) return
    updateCover(coverDialog.id, coverDialog.value.trim() || undefined)
    await persist()
    setCoverDialog(null)
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
              <div>
                <h1 className="saved-title">{_(messages.title)}</h1>
                <p className="saved-subtitle">{_(messages.subtitle)}</p>
              </div>
              <div className="saved-header-actions">
                <button
                  type="button"
                  className="saved-button primary"
                  onClick={() =>
                    setNameDialog({mode: 'create', name: ''})
                  }>
                  <Plus size={16} aria-hidden={true} />
                  {_(messages.newCollection)}
                </button>
              </div>
            </header>

            <div className="saved-controls">
              <SearchBar
                value={query}
                onChange={setQuery}
                placeholder={_(messages.searchCollections)}
              />
              <SortMenu
                value={sort}
                onChange={value => setSort(value as SortOption)}
                options={sortOptions}
                label={_(messages.sortLabel)}
              />
            </div>

            {!ready ? (
              <LoadingSkeleton variant="collections" count={8} />
            ) : sortedCollections.length === 0 ? (
              <EmptyState
                title={_(
                  query.trim() ? messages.searchEmptyTitle : messages.emptyTitle,
                )}
                description={_(
                  query.trim()
                    ? messages.searchEmptyDescription
                    : messages.emptyDescription,
                )}
                actionLabel={
                  query.trim() ? undefined : _(messages.emptyAction)
                }
                onAction={
                  query.trim()
                    ? undefined
                    : () => setNameDialog({mode: 'create', name: ''})
                }
              />
            ) : (
              <div className="saved-grid">
                {sortedCollections.map(collection => {
                  const previews = getCollectionPreviewImages(
                    collection,
                    postsByUri,
                  )
                  const menuItems: MenuItem[] = [
                    {
                      label: _(messages.rename),
                      icon: PencilLine,
                      onSelect: () =>
                        setNameDialog({
                          mode: 'rename',
                          id: collection.id,
                          name: collection.name,
                        }),
                    },
                    {
                      label: _(messages.updateCover),
                      icon: ImageIcon,
                      onSelect: () =>
                        setCoverDialog({
                          id: collection.id,
                          value: collection.coverUri || '',
                        }),
                    },
                    {
                      label: _(messages.delete),
                      icon: Trash2,
                      destructive: true,
                      onSelect: () =>
                        setConfirmDelete({
                          id: collection.id,
                          name: collection.name,
                        }),
                    },
                  ]

                  return (
                    <CollectionCard
                      key={collection.id}
                      title={collection.name}
                      countLabel={formatCount(collection.itemUris.length)}
                      previewImages={previews}
                      onOpen={() =>
                        navigation.navigate('BookmarksCollection', {
                          collectionId: collection.id,
                        })
                      }
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
        open={Boolean(nameDialog)}
        title={
          nameDialog?.mode === 'rename'
            ? _(messages.renameTitle)
            : _(messages.createTitle)
        }
        onClose={() => setNameDialog(null)}>
        <input
          value={nameDialog?.name ?? ''}
          onChange={event =>
            setNameDialog(prev =>
              prev ? {...prev, name: event.target.value} : prev,
            )
          }
          placeholder={_(messages.newCollection)}
          autoFocus
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void onSubmitName()
            }
          }}
        />
        <div className="saved-modal-actions">
          <button
            type="button"
            className="saved-button ghost"
            onClick={() => setNameDialog(null)}>
            {_(messages.cancel)}
          </button>
          <button
            type="button"
            className="saved-button primary"
            onClick={onSubmitName}>
            {nameDialog?.mode === 'rename'
              ? _(messages.save)
              : _(messages.create)}
          </button>
        </div>
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        title={_(messages.deleteTitle)}
        description={_(messages.deleteDescription)}
        onClose={() => setConfirmDelete(null)}>
        <div className="saved-modal-actions">
          <button
            type="button"
            className="saved-button ghost"
            onClick={() => setConfirmDelete(null)}>
            {_(messages.cancel)}
          </button>
          <button
            type="button"
            className="saved-button danger"
            onClick={onConfirmDelete}>
            {_(messages.delete)}
          </button>
        </div>
      </Modal>

      <Modal
        open={Boolean(coverDialog)}
        title={_(messages.coverTitle)}
        description={_(messages.coverDescription)}
        onClose={() => setCoverDialog(null)}>
        <input
          value={coverDialog?.value ?? ''}
          onChange={event =>
            setCoverDialog(prev =>
              prev ? {...prev, value: event.target.value} : prev,
            )
          }
          placeholder={_(messages.coverPlaceholder)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void onSaveCover()
            }
          }}
        />
        <div className="saved-modal-actions">
          <button
            type="button"
            className="saved-button ghost"
            onClick={() => setCoverDialog(null)}>
            {_(messages.cancel)}
          </button>
          <button
            type="button"
            className="saved-button primary"
            onClick={onSaveCover}>
            {_(messages.save)}
          </button>
        </div>
      </Modal>
    </Layout.Screen>
  )
}
