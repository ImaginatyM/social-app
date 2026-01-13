import { CuratedSource, NewsCategory } from './types'

export const NEWS_CATEGORIES: NewsCategory[] = [
  { id: 'top', title: 'À la une', slug: 'top' },
  { id: 'tech', title: 'Tech', slug: 'tech' },
  { id: 'culture', title: 'Culture', slug: 'culture' },
]

/**
 * Tu mets ici les at:// URIs des posts "racine" qui ouvrent un thread
 * Exemple: at://did:plc:xxxx/app.bsky.feed.post/3kz...
 */
export const CURATED_SOURCES: CuratedSource[] = [
  { categoryId: 'top', roots: [] },
  { categoryId: 'tech', roots: [] },
  { categoryId: 'culture', roots: [] },
]
