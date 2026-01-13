import React from 'react'

import {CURATED_SOURCES, NEWS_CATEGORIES} from '../features/news/sources.curated'
import {useNewsStore} from '../features/news/newsStore'
import {fetchThreadAsArticle} from '../lib/news/atThread'
import type {Article} from '../features/news/types'

export default function News() {
  const {byId, setMany} = useNewsStore()
  const [loading, setLoading] = React.useState(false)
  const [category, setCategory] = React.useState(NEWS_CATEGORIES[0]?.id ?? '')
  const [open, setOpen] = React.useState<Article | null>(null)

  const sources = React.useMemo(
    () => CURATED_SOURCES.find(source => source.categoryId === category),
    [category],
  )

  const load = React.useCallback(async () => {
    if (!sources) return
    setLoading(true)
    const articles: Article[] = []
    for (const uri of sources.roots) {
      const article = await fetchThreadAsArticle(uri, category).catch(() => null)
      if (article) articles.push(article)
    }
    setMany(articles)
    setLoading(false)
  }, [sources, category, setMany])

  React.useEffect(() => {
    load()
  }, [load])

  const list = React.useMemo(
    () => (sources?.roots || []).map(id => byId[id]).filter(Boolean) as Article[],
    [sources, byId],
  )

  return (
    <div style={{display: 'grid', gap: 16}}>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <h1 style={{fontSize: 28, fontWeight: 800, letterSpacing: -0.5}}>News</h1>
        <div>
          <select value={category} onChange={e => setCategory(e.target.value)}>
            {NEWS_CATEGORIES.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <div>Chargement…</div>}
      {!loading && list.length === 0 && (
        <div style={{opacity: 0.7}}>Aucun article dans cette catégorie.</div>
      )}

      <div
        style={{
          display: 'grid',
          gap: 16,
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        }}
      >
        {list.map(article => (
          <ArticleCard key={article.id} article={article} onOpen={() => setOpen(article)} />
        ))}
      </div>

      {open && <ArticleReader article={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function ArticleCard({
  article,
  onOpen,
}: {
  article: Article
  onOpen: () => void
}) {
  return (
    <div
      onClick={onOpen}
      style={{
        cursor: 'pointer',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid #eee',
        background: '#fff',
      }}
    >
      {article.cover && (
        <img
          src={article.cover}
          alt=""
          style={{width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block'}}
        />
      )}
      <div style={{padding: 12}}>
        <div
          style={{
            fontSize: 12,
            opacity: 0.65,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            marginBottom: 6,
          }}
        >
          {article.categoryId}
        </div>
        <div style={{fontSize: 18, fontWeight: 700, lineHeight: 1.2}}>{article.title}</div>
        {article.byline && (
          <div style={{marginTop: 8, fontSize: 13, opacity: 0.8}}>{article.byline}</div>
        )}
      </div>
    </div>
  )
}

function ArticleReader({
  article,
  onClose,
}: {
  article: Article
  onClose: () => void
}) {
  return (
    <div
      onClick={onClose}
      style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 100}}
    >
      <div
        onClick={event => event.stopPropagation()}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 'min(1000px, 92vw)',
          height: 'min(90vh, 980px)',
          background: '#fff',
          borderRadius: 16,
          overflow: 'hidden',
          display: 'grid',
          gridTemplateRows: 'auto 1fr',
        }}
      >
        <div>
          {article.cover && (
            <img
              src={article.cover}
              alt=""
              style={{width: '100%', maxHeight: 360, objectFit: 'cover', display: 'block'}}
            />
          )}
          <div style={{padding: '18px 22px'}}>
            <div
              style={{fontSize: 12, textTransform: 'uppercase', opacity: 0.6, letterSpacing: 0.6}}
            >
              {article.categoryId}
            </div>
            <h2
              style={{
                fontFamily:
                  'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
                fontSize: 32,
                lineHeight: 1.15,
                margin: '6px 0 0',
                letterSpacing: -0.2,
              }}
            >
              {article.title}
            </h2>
            {article.byline && (
              <div style={{marginTop: 6, fontSize: 14, opacity: 0.75}}>
                Par {article.byline}
              </div>
            )}
          </div>
        </div>

        <div style={{overflow: 'auto', padding: '0 22px 22px 22px'}}>
          <div
            style={{
              maxWidth: 760,
              margin: '16px auto 0',
              fontSize: 18,
              lineHeight: 1.7,
              fontFamily:
                '-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,system-ui',
            }}
          >
            {article.blocks.map((block, index) => {
              if (block.type === 'paragraph') {
                return (
                  <p key={index} style={{margin: '0 0 18px'}}>
                    {block.text}
                  </p>
                )
              }
              if (block.type === 'image') {
                return (
                  <figure key={index} style={{margin: '22px 0'}}>
                    <img
                      src={block.url}
                      alt=""
                      style={{width: '100%', borderRadius: 12, display: 'block'}}
                    />
                    {block.caption && (
                      <figcaption style={{fontSize: 13, opacity: 0.65, marginTop: 6}}>
                        {block.caption}
                      </figcaption>
                    )}
                  </figure>
                )
              }
              return null
            })}
          </div>
        </div>
      </div>
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          width: 40,
          height: 40,
          borderRadius: 999,
          background: '#fff',
        }}
      >
        ✕
      </button>
    </div>
  )
}
