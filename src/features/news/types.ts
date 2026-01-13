export type NewsCategory = {
  id: string
  title: string
  slug: string
}

export type ArticleBlock =
  | {
      type: 'paragraph'
      text: string
    }
  | {
      type: 'image'
      url: string
      caption?: string
    }

export type Article = {
  id: string
  categoryId: string
  title: string
  cover?: string
  byline?: string
  publishedAt?: string
  author?: {
    handle?: string
    displayName?: string
    avatar?: string
  }
  blocks: ArticleBlock[]
}

export type CuratedSource = {
  categoryId: string
  roots: string[]
}
