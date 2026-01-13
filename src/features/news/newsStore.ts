import {create} from 'zustand'
import {persist} from 'zustand/middleware'

import type {Article} from './types'

type State = {
  byId: Record<string, Article>
  setMany: (articles: Article[]) => void
  clear: () => void
}

export const useNewsStore = create<State>()(
  persist(
    (set, get) => ({
      byId: {},
      setMany: articles => {
        const next = {...get().byId}
        for (const article of articles) {
          next[article.id] = article
        }
        set({byId: next})
      },
      clear: () => set({byId: {}}),
    }),
    {name: 'sparker-news-cache'},
  ),
)
