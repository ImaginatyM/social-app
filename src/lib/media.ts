// src/lib/media.ts
export type Media =
  | { type: 'video'; url: string; poster?: string }
  | { type: 'image'; url: string; alt?: string }
  | null;

const isHttp = (s: any) => typeof s === 'string' && /^(https?:)?\/\//.test(s);
const isVideoUrl = (s: any) =>
  typeof s === 'string' && /(\.m3u8|\.mp4)(\?|$)/i.test(s);

// Cherche des miniatures probables dans un sous-objet
function sniffPoster(obj: any): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const cands = [
    obj.thumbnail,
    obj.thumb,
    obj.poster,
    obj.image,
    obj.preview,
    obj?.external?.thumb,
    obj?.external?.image,
    obj?.images?.[0]?.thumb,
    obj?.images?.[0]?.fullsize,
  ];
  const hit = cands.find(isHttp);
  return typeof hit === 'string' ? hit : undefined;
}

// Renvoie l'URL vidéo si elle est trouvée dans cet objet (et sous-objets)
function deepFindVideoUrl(obj: any, depth = 0): string | null {
  if (!obj || typeof obj !== 'object' || depth > 8) return null;

  // champs connus
  const direct =
    obj.playlist ??
    obj.url ??
    obj.source?.url ??
    obj.sources?.[0]?.url ??
    obj.media?.playlist ??
    obj.media?.url ??
    obj.video?.playlist ??
    obj.video?.url;
  if (isVideoUrl(direct)) return direct;

  // parfois l'URL vidéo est dans "variants" ou "sources"
  const variants = Array.isArray(obj.variants) ? obj.variants : obj.sources;
  if (Array.isArray(variants)) {
    for (const v of variants) {
      if (isVideoUrl(v?.url)) return v.url;
    }
  }

  // exploration large : si une clé s'appelle "uri" ou "href" et ressemble à une vidéo
  for (const [k, v] of Object.entries(obj)) {
    if (isVideoUrl(v)) return v as string;
    if ((k === 'uri' || k === 'href') && isVideoUrl(v)) return v as string;
  }

  // récursif
  for (const v of Object.values(obj)) {
    if (typeof v === 'object') {
      const found = deepFindVideoUrl(v, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

// Petit util pour debug : collecter tous les $type
export function collectTypes(obj: any, out = new Set<string>(), depth = 0): Set<string> {
  if (!obj || typeof obj !== 'object' || depth > 8) return out;
  if (typeof obj.$type === 'string') out.add(obj.$type);
  for (const v of Object.values(obj)) {
    if (typeof v === 'object') collectTypes(v, out, depth + 1);
  }
  return out;
}

export function getPrimaryMedia(item: any): Media {
  const root = item?.post ?? item;
  const embed = root?.embed ?? root;
  const url = deepFindVideoUrl(embed);
  if (url) {
    return { type: 'video', url, poster: sniffPoster(embed) };
  }
  // fallback image (utile pour galerie)
  const img =
    embed?.images?.[0]?.fullsize ??
    embed?.images?.[0]?.thumb ??
    embed?.image ??
    embed?.thumb;
  if (isHttp(img)) return { type: 'image', url: img };
  return null;
}

export function hasVideo(item: any): boolean {
  return getPrimaryMedia(item)?.type === 'video';
}
