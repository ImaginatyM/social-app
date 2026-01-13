import {create} from 'zustand'

export type FeedLayout = 'twitter' | 'gallery' | 'tiktok'

type FeedLayoutState = {
  layout: FeedLayout
  setLayout: (layout: FeedLayout) => void
  activeFeedUri: string | null
  setActiveFeedUri: (uri: string | null) => void
  hydrate: () => void
}

const LS_KEY = 'ui.feed.layout.v1'
const LS_FEED = 'ui.feed.activeFeed.v1'

function safeSetItem(key: string, value: string) {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return
  }
  try {
    localStorage.setItem(key, value)
  } catch {}
}

function safeGetItem(key: string): string | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null
  }
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const VALID_LAYOUTS: FeedLayout[] = ['twitter', 'gallery', 'tiktok']

export const useFeedLayout = create<FeedLayoutState>((set, get) => ({
  layout: 'twitter',
  setLayout: layout => {
    if (get().layout === layout) {
      return
    }
    set({layout})
    safeSetItem(LS_KEY, layout)
  },
  activeFeedUri: null,
  setActiveFeedUri: uri => {
    if (get().activeFeedUri === uri) {
      return
    }
    set({activeFeedUri: uri})
    safeSetItem(LS_FEED, uri ?? '')
  },
  hydrate: () => {
    const storedLayout = safeGetItem(LS_KEY) as FeedLayout | null
    const storedFeed = safeGetItem(LS_FEED)
    const layout = storedLayout && VALID_LAYOUTS.includes(storedLayout)
      ? storedLayout
      : 'twitter'
    set(state => ({
      layout: layout ?? state.layout,
      activeFeedUri: storedFeed ? storedFeed : null,
    }))
  },
}))
