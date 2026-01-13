import React from 'react'
import {useSavedCollections} from '../state/savedCollections'

export default function SaveToCollectionSheet({
  atUri,
  onClose,
}: {
  atUri: string
  onClose: () => void
}) {
  const ready = useSavedCollections(state => state.ready)
  const load = useSavedCollections(state => state.load)
  const collections = useSavedCollections(state => state.collections)
  const ensureDefault = useSavedCollections(state => state.ensureDefault)
  const addItem = useSavedCollections(state => state.addItem)
  const removeItem = useSavedCollections(state => state.removeItem)
  const createCollection = useSavedCollections(state => state.create)
  const persist = useSavedCollections(state => state.persist)
  const contains = useSavedCollections(state => state.contains)

  const [newName, setNewName] = React.useState('')
  const [checked, setChecked] = React.useState<Record<string, boolean>>({})

  React.useEffect(() => {
    if (!ready) {
      void load()
    }
  }, [ready, load])

  React.useEffect(() => {
    if (ready && collections.length === 0) {
      ensureDefault()
    }
  }, [ready, collections.length, ensureDefault])

  React.useEffect(() => {
    setChecked(prev => {
      const marked = new Set(contains(atUri).ids)
      const next: Record<string, boolean> = {}
      for (const c of collections) {
        if (typeof prev[c.id] === 'boolean') {
          next[c.id] = prev[c.id]
        } else {
          next[c.id] = marked.has(c.id)
        }
      }
      return next
    })
  }, [collections, contains, atUri])

  const toggle = (id: string) => {
    setChecked(prev => ({...prev, [id]: !prev[id]}))
  }

  const onCreate = async () => {
    const id = createCollection(newName || 'Nouvelle collection')
    setNewName('')
    setChecked(prev => ({...prev, [id]: true}))
  }

  const onSave = async () => {
    for (const c of collections) {
      if (checked[c.id] && !c.itemUris.includes(atUri)) {
        addItem(c.id, atUri)
      }
      if (!checked[c.id] && c.itemUris.includes(atUri)) {
        removeItem(c.id, atUri)
      }
    }
    await persist()
    onClose()
  }

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={sheet} onClick={e => e.stopPropagation()}>
        <h3>Enregistrer dans…</h3>

        <div style={{maxHeight: 300, overflow: 'auto', marginTop: 8}}>
          {collections.map(c => (
            <label
              key={c.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: '1px solid #eee',
              }}>
              <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                <input
                  type="checkbox"
                  checked={!!checked[c.id]}
                  onChange={() => toggle(c.id)}
                />
                <span>{c.name}</span>
              </div>
              <small style={{opacity: 0.6}}>{c.itemUris.length}</small>
            </label>
          ))}
        </div>

        <div style={{display: 'flex', gap: 8, marginTop: 12}}>
          <input
            placeholder="Nouvelle collection…"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            style={{flex: 1}}
          />
          <button onClick={onCreate}>Créer</button>
        </div>

        <div
          style={{display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12}}>
          <button onClick={onClose}>Annuler</button>
          <button onClick={onSave}>Enregistrer</button>
        </div>
      </div>
    </div>
  )
}

const backdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,.5)',
  zIndex: 200,
}
const sheet: React.CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%,-50%)',
  background: '#fff',
  borderRadius: 12,
  padding: 16,
  width: 'min(540px, 92vw)',
}
