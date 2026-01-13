import {create} from 'zustand'
import {persist} from 'zustand/middleware'
export type FeedViewMode = 'classic'|'gallery'|'immersive'
type S = { mode: FeedViewMode; setMode:(m:FeedViewMode)=>void }
export const useFeedViewStore = create<S>()(persist(
  (set)=>({ mode:'classic', setMode:(m)=>set({mode:m}) }),
  { name:'sparker-feed-view-mode' }
))
