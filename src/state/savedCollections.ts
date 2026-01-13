import { create } from 'zustand'
import { Collection, loadCollections, saveCollections } from '../lib/storage/savedCollections'

type SavedCollectionsState = {
  ready: boolean
  collections: Collection[]
  selectedId?: string

  load: () => Promise<void>
  persist: () => Promise<void>
  ensureDefault: () => string

  create: (name: string) => string
  rename: (id: string, name: string) => void
  remove: (id: string) => void
  select: (id?: string) => void
  updateCover: (id: string, coverUri?: string) => void

  addItem: (id: string, atUri: string) => void
  removeItem: (id: string, atUri: string) => void
  moveItem: (fromId: string, toId: string, atUri: string) => void

  contains: (atUri: string) => { inAny: boolean; ids: string[] }
}

function now(){ return Date.now() }

export const useSavedCollections = create<SavedCollectionsState>((set, get) => ({
  ready: false,
  collections: [],
  selectedId: undefined,

  load: async () => {
    const list = await loadCollections()
    set({ collections: list, ready: true })
  },

  persist: async () => {
    await saveCollections(get().collections)
  },

  ensureDefault: () => {
    const s = get()
    const has = s.collections.find(c => c.id === 'default')
    if (has) return has.id
    const col: Collection = {
      id: 'default',
      name: 'Général',
      createdAt: now(),
      updatedAt: now(),
      itemUris: [],
      coverUri: undefined,
    }
    set({ collections: [col, ...s.collections] })
    return 'default'
  },

  create: (name) => {
    const id = `col_${now()}_${Math.random().toString(36).slice(2,8)}`
    const col: Collection = {
      id,
      name: name.trim() || 'Sans titre',
      createdAt: now(),
      updatedAt: now(),
      itemUris: [],
      coverUri: undefined,
    }
    set(s => ({ collections: [col, ...s.collections], selectedId: id }))
    return id
  },

  rename: (id, name) => {
    set(s => ({
      collections: s.collections.map(c => c.id===id ? { ...c, name: name.trim() || c.name, updatedAt: now() } : c)
    }))
  },

  remove: (id) => {
    set(s => ({
      collections: s.collections.filter(c => c.id !== id),
      selectedId: s.selectedId === id ? undefined : s.selectedId,
    }))
  },

  select: (id) => set({ selectedId: id }),

  updateCover: (id, coverUri) => {
    set(s => ({
      collections: s.collections.map(c =>
        c.id === id
          ? {
              ...c,
              coverUri: coverUri?.trim() || undefined,
              updatedAt: now(),
            }
          : c,
      ),
    }))
  },

  addItem: (id, atUri) => {
    set(s => ({
      collections: s.collections.map(c => {
        if (c.id !== id) return c
        if (c.itemUris.includes(atUri)) return c
        return { ...c, itemUris: [atUri, ...c.itemUris], updatedAt: now() }
      })
    }))
  },

  removeItem: (id, atUri) => {
    set(s => ({
      collections: s.collections.map(c => {
        if (c.id !== id) return c
        return { ...c, itemUris: c.itemUris.filter(u => u !== atUri), updatedAt: now() }
      })
    }))
  },

  moveItem: (fromId, toId, atUri) => {
    const { removeItem, addItem } = get()
    removeItem(fromId, atUri)
    addItem(toId, atUri)
  },

  contains: (atUri) => {
    const ids = get().collections.filter(c => c.itemUris.includes(atUri)).map(c => c.id)
    return { inAny: ids.length > 0, ids }
  }
}))
