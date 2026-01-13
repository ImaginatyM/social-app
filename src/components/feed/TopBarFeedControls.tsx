import React, { useEffect } from 'react'
import { useAtFeedsStore } from '../../state/atFeedsStore'
import { useFeedViewStore, FeedViewMode } from '../../state/feedViewStore'

export default function TopBarFeedControls({ onFeedChange }: { onFeedChange?: (uri: string) => void }) {
  const { feeds, selectedFeedUri, setSelectedFeed, refreshFeeds } = useAtFeedsStore()
  const { mode, setMode } = useFeedViewStore()

  useEffect(() => {
    refreshFeeds().catch(() => {})
  }, [])

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        background: '#fff',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        padding: '8px 12px',
        borderBottom: '1px solid #eee',
      }}
    >
      {/* Sélecteur feed */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, opacity: 0.7 }}>Feed</span>
        <select
          value={selectedFeedUri ?? ''}
          onChange={(e) => {
            setSelectedFeed(e.target.value)
            onFeedChange?.(e.target.value)
          }}
          style={{ minWidth: 180, padding: '6px 8px' }}
        >
          {feeds.length === 0 && <option value="">Chargement…</option>}
          {feeds.map((f) => (
            <option key={f.uri} value={f.uri}>
              {f.displayName}
            </option>
          ))}
        </select>
      </label>

      {/* Sélecteur affichage */}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, opacity: 0.7 }}>Affichage</span>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as FeedViewMode)}
          style={{ minWidth: 160, padding: '6px 8px' }}
        >
          <option value="classic">Classique</option>
          <option value="gallery">Galerie</option>
          <option value="immersive">Immersif</option>
        </select>
      </label>

      <div style={{ flex: 1 }} />
    </div>
  )
}
