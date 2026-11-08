// Couche IndexedDB : toutes les données de l'application sont stockées ici, sur l'appareil.
const DB_NAME = 'mon-academie'
const DB_VERSION = 1

// Stores d'objets (clé = id), plus « kv » (clé = key) pour réglages et état du chronomètre.
export const STORES = ['subjects', 'chapters', 'timetable', 'sessions', 'logs', 'evaluations', 'documents', 'annotations', 'bookmarks', 'kv']
export const FILES = 'files' // contenu binaire des PDF : { id, name, type, size, data: ArrayBuffer }

let dbPromise = null

export function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: s === 'kv' ? 'key' : 'id' })
      }
      if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES, { keyPath: 'id' })
    }
    req.onsuccess = () => {
      const db = req.result
      db.onversionchange = () => { db.close(); dbPromise = null }
      resolve(db)
    }
    req.onerror = () => { dbPromise = null; reject(req.error) }
    req.onblocked = () => { dbPromise = null; reject(new Error('Base de données bloquée par un autre onglet.')) }
  })
  return dbPromise
}

export async function closeDB() {
  if (!dbPromise) return
  const db = await dbPromise
  db.close()
  dbPromise = null
}

async function run(store, mode, fn) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode)
    const os = tx.objectStore(store)
    let result
    try { result = fn(os) } catch (e) { reject(e); return }
    tx.oncomplete = () => resolve(result && 'result' in result ? result.result : result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error || new Error('Transaction annulée'))
  })
}

export const getAll = (store) => run(store, 'readonly', (os) => os.getAll())
export const get = (store, key) => run(store, 'readonly', (os) => os.get(key))
export const put = (store, value) => run(store, 'readwrite', (os) => { os.put(value) })
export const putMany = (store, values) => run(store, 'readwrite', (os) => { for (const v of values) os.put(v) })
export const del = (store, key) => run(store, 'readwrite', (os) => { os.delete(key) })
export const delMany = (store, keys) => run(store, 'readwrite', (os) => { for (const k of keys) os.delete(k) })
export const clear = (store) => run(store, 'readwrite', (os) => { os.clear() })

export async function clearAll() {
  for (const s of [...STORES, FILES]) await clear(s)
}

export function isQuotaError(e) {
  return !!e && (e.name === 'QuotaExceededError' || e.code === 22 || /quota/i.test(e.message || ''))
}

// Remplacement atomique de tout le contenu (restauration) : en cas d'erreur, rien n'est modifié.
export async function replaceAll(payload) {
  const db = await openDB()
  const names = [...STORES, FILES]
  return new Promise((resolve, reject) => {
    const tx = db.transaction(names, 'readwrite')
    for (const n of names) {
      const os = tx.objectStore(n)
      os.clear()
      for (const r of payload[n] || []) os.put(r)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error || new Error('Restauration annulée'))
  })
}
