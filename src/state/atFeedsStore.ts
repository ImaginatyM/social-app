import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type AtFeed = { uri: string; displayName: string }

type S = {
  feeds: AtFeed[]
  selectedFeedUri: string | null
  setSelectedFeed: (uri: string) => void
  setFeeds: (fs: AtFeed[]) => void
  refreshFeeds: () => Promise<void>
}

// TODO: remplace fetchAvailableFeeds par ton vrai fetch AT proto
async function fetchAvailableFeeds(): Promise<AtFeed[]> {
  return [
    { uri: 'at://did:algo/home', displayName: 'Accueil' },
    { uri: 'at://did:algo/following', displayName: 'Abonnements' },
  ]
}

export const useAtFeedsStore = create<S>()(
  persist(
    (set, get) => ({
      feeds: [],
      selectedFeedUri: null,
      setSelectedFeed: (uri) => set({ selectedFeedUri: uri }),
      setFeeds: (fs) =>
        set({ feeds: fs, selectedFeedUri: get().selectedFeedUri ?? fs[0]?.uri ?? null }),
      refreshFeeds: async () => {
        const fs = await fetchAvailableFeeds()
        set({ feeds: fs, selectedFeedUri: get().selectedFeedUri ?? fs[0]?.uri ?? null })
      },
    }),
    { name: 'sparker-at-feeds' },
  ),
)
