import type {Article, ArticleBlock} from '../../features/news/types'

// Utilise ton agent bsky existant; adapte l'import si besoin
import {createPublicAgent} from '../../state/session/agent'

const agent = createPublicAgent()

function getImagesFromPost(post: any) {
  const imgs =
    post?.embed?.images ||
    post?.record?.embed?.images ||
    post?.embed?.media?.images ||
    []
  return imgs
    .map((im: any) => im?.fullsize || im?.thumb || im?.url)
    .filter(Boolean)
}

export async function fetchThreadAsArticle(
  rootUri: string,
  categoryId: string,
): Promise<Article | null> {
  // 1) récup thread
  const res = await agent.getPostThread?.({uri: rootUri, depth: 50}) // adapte signature si différent
  const thread = res?.data?.thread
  if (!thread || !thread?.post) return null

  const root = thread.post
  const author = root?.post?.author || root?.author
  const postRec = root?.post?.record || root?.record

  // 2) titre & cover
  const rawText: string = (postRec?.text || '').trim()
  const lines = rawText.split('\n').map(s => s.trim()).filter(Boolean)
  const title = lines[0] || '(Sans titre)'
  const cover = getImagesFromPost(root?.post || root)[0]

  // 3) blocs
  const blocks: ArticleBlock[] = []
  // - paragraphes du premier post (hors titre)
  const firstBody = lines.slice(1).join('\n').trim()
  if (firstBody) blocks.push({type: 'paragraph', text: firstBody})

  // - images du premier post (hors cover si tu veux éviter doublon)
  const imgs0 = getImagesFromPost(root?.post || root)
  imgs0.slice(cover ? 1 : 0).forEach(url => blocks.push({type: 'image', url}))

  // 4) descendre le thread et ne prendre que les posts du même auteur
  const myDid = author?.did || author?.didDoc?.id
  function walk(node: any) {
    const replies = node?.replies || []
    for (const r of replies) {
      const p = r?.post || r
      const pRec = p?.record
      const pAuthor = p?.author
      if (pAuthor?.did === myDid) {
        const t = (pRec?.text || '').trim()
        if (t) blocks.push({type: 'paragraph', text: t})
        const imgs = getImagesFromPost(p)
        imgs.forEach((url: string) => blocks.push({type: 'image', url}))
      }
      // continue descente
      walk(r)
    }
  }
  walk(thread)

  const art: Article = {
    id: rootUri,
    categoryId,
    title,
    cover,
    byline: author?.displayName || author?.handle,
    publishedAt: postRec?.createdAt || root?.post?.indexedAt || undefined,
    author: {
      handle: author?.handle,
      displayName: author?.displayName,
      avatar: author?.avatar,
    },
    blocks,
  }
  return art
}
