import { useSavedCollections } from './savedCollections'
import { getMigratedFlag, setMigratedFlag } from '../lib/storage/savedCollections'

// TODO: adapte getLegacySavedUris() à TA source existante des posts "enregistrés"
async function getLegacySavedUris(): Promise<string[]> {
  // Exemple: si tu avais un store/bookmarks : return thatStore.getState().savedUris
  return []
}

export async function migrateLegacySavesToDefault() {
  const already = await getMigratedFlag()
  if (already) return
  const savedUris = await getLegacySavedUris()
  if (!savedUris.length) {
    await setMigratedFlag()
    return
  }

  const st = useSavedCollections.getState()
  const defId = st.ensureDefault()
  savedUris.forEach(u => st.addItem(defId, u))
  await st.persist()
  await setMigratedFlag()
}

