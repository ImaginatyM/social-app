export type AtPost = any

export function getPostImages(p: AtPost) {
  const imgs =
    p?.embed?.images ||
    p?.record?.embed?.images ||
    p?.embed?.media?.images ||
    []
  return (imgs || [])
    .map((im: any) => ({ url: im?.fullsize || im?.thumb || im?.url }))
    .filter((x) => !!x.url)
}
function findVideo(node: any, seen = new Set<any>()): any | null {
  if (!node || typeof node !== 'object') return null
  if (seen.has(node)) return null
  seen.add(node)

  if (node.video && typeof node.video === 'object') {
    const vid = node.video
    const url = vid?.playback || vid?.playlist || vid?.url || vid?.src || vid?.file
    if (url) {
      return vid
    }
  }

  if (node.media?.video) {
    const vid = node.media.video
    const url = vid?.playback || vid?.playlist || vid?.url || vid?.src || vid?.file
    if (url) {
      return vid
    }
  }

  const next: any[] = []

  if (Array.isArray(node)) {
    next.push(...node)
  } else {
    if (node.embed) next.push(node.embed)
    if (node.record) next.push(node.record)
    if (node.value) next.push(node.value)
    if (node.post) next.push(node.post)
    if (node.media) next.push(node.media)
    if (node.primary) next.push(node.primary)
    if (node.contents) next.push(node.contents)
    if (node.attachments) next.push(node.attachments)
  }

  for (const child of next) {
    const found = findVideo(child, seen)
    if (found) return found
  }

  return null
}

export function getPostVideo(p: AtPost) {
  const raw = findVideo(p?.embed) || findVideo(p?.record) || findVideo(p)
  if (!raw) return null
  const url = raw?.playback || raw?.playlist || raw?.url || raw?.src || raw?.file
  if (!url) return null
  return {url, thumb: raw?.thumbnail || raw?.thumb || raw?.preview}
}
export function onlyImagePosts(posts: AtPost[]) {
  return posts.filter((p) => getPostImages(p).length > 0)
}
export function isVideoOnly(p: AtPost) {
  return !!getPostVideo(p)
}
export function getCounts(p: any) {
  // TODO : branche sur tes vraies métriques AT si dispo
  const like = p?.likeCount ?? p?.metrics?.likes ?? 0
  const comment = p?.replyCount ?? p?.metrics?.replies ?? 0
  return {like, comment}
}
export function hasMultipleImages(p: any) {
  const imgs = getPostImages(p)
  return imgs.length > 1
}
export function isVideo(p: any) {
  return !!getPostVideo(p)
}
