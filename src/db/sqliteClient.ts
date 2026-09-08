import initSqlJs, { type Database } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'

import type { Deck } from '../types/deck'

const DATABASE_NAME = 'magic-catalog-sqlite'
const DATABASE_VERSION = 3
const DATABASE_STORE = 'database'
const DATABASE_KEY = 'catalog'
const DOWNLOADS_STORE = 'catalog-downloads'
const DECKS_STORE = 'decks'
const REQUIRED_CATALOG_COLUMNS = [
  'primary_face_name',
  'primary_mana_value',
  'collector_number_numeric',
  'collector_number_suffix',
  'printing_preference_rank',
] as const

let databasePromise: Promise<Database | null> | null = null

function openStorage(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(DATABASE_STORE)) db.createObjectStore(DATABASE_STORE)
      if (!db.objectStoreNames.contains(DOWNLOADS_STORE)) db.createObjectStore(DOWNLOADS_STORE)
      if (!db.objectStoreNames.contains(DECKS_STORE)) db.createObjectStore(DECKS_STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export interface CatalogDownloadCheckpoint {
  bytes: Uint8Array
  totalBytes?: number
}

export async function readCatalogDownloadCheckpoint(
  key: string,
): Promise<CatalogDownloadCheckpoint | null> {
  const storage = await openStorage()
  return new Promise((resolve, reject) => {
    const request = storage.transaction(DOWNLOADS_STORE, 'readonly')
      .objectStore(DOWNLOADS_STORE)
      .get(key)
    request.onsuccess = () => {
      storage.close()
      const checkpoint = request.result as { bytes: Uint8Array; totalBytes?: number } | undefined
      resolve(checkpoint ? { bytes: new Uint8Array(checkpoint.bytes), totalBytes: checkpoint.totalBytes } : null)
    }
    request.onerror = () => {
      storage.close()
      reject(request.error)
    }
  })
}

export async function persistCatalogDownloadCheckpoint(
  key: string,
  checkpoint: CatalogDownloadCheckpoint,
): Promise<void> {
  const storage = await openStorage()
  await new Promise<void>((resolve, reject) => {
    const request = storage.transaction(DOWNLOADS_STORE, 'readwrite')
      .objectStore(DOWNLOADS_STORE)
      .put({
        bytes: checkpoint.bytes,
        totalBytes: checkpoint.totalBytes,
      }, key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
  storage.close()
}

export async function clearCatalogDownloadCheckpoint(key: string): Promise<void> {
  const storage = await openStorage()
  await new Promise<void>((resolve, reject) => {
    const request = storage.transaction(DOWNLOADS_STORE, 'readwrite')
      .objectStore(DOWNLOADS_STORE)
      .delete(key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
  storage.close()
}

async function readStoredDatabase(): Promise<Uint8Array | null> {
  const storage = await openStorage()
  return new Promise((resolve, reject) => {
    const request = storage.transaction(DATABASE_STORE, 'readonly')
      .objectStore(DATABASE_STORE)
      .get(DATABASE_KEY)
    request.onsuccess = () => {
      storage.close()
      resolve(request.result ? new Uint8Array(request.result) : null)
    }
    request.onerror = () => {
      storage.close()
      reject(request.error)
    }
  })
}

export async function persistCatalogDatabase(bytes: Uint8Array): Promise<void> {
  const storage = await openStorage()
  await new Promise<void>((resolve, reject) => {
    const request = storage.transaction(DATABASE_STORE, 'readwrite')
      .objectStore(DATABASE_STORE)
      .put(bytes, DATABASE_KEY)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
  storage.close()
}

export async function persistCatalogMetadata(metadata: unknown): Promise<void> {
  const storage = await openStorage()
  await new Promise<void>((resolve, reject) => {
    const request = storage.transaction(DATABASE_STORE, 'readwrite')
      .objectStore(DATABASE_STORE)
      .put(metadata, 'metadata')
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
  storage.close()
}

export async function readCatalogMetadata<T>(): Promise<T | undefined> {
  const storage = await openStorage()
  return new Promise((resolve, reject) => {
    const request = storage.transaction(DATABASE_STORE, 'readonly')
      .objectStore(DATABASE_STORE)
      .get('metadata')
    request.onsuccess = () => {
      storage.close()
      resolve(request.result as T | undefined)
    }
    request.onerror = () => {
      storage.close()
      reject(request.error)
    }
  })
}

export async function clearCatalogDatabase(): Promise<void> {
  databasePromise = null
  const storage = await openStorage()
  await new Promise<void>((resolve, reject) => {
    const request = storage.transaction(DATABASE_STORE, 'readwrite')
    const databaseStore = request.objectStore(DATABASE_STORE)
    databaseStore.delete(DATABASE_KEY)
    databaseStore.delete('metadata')
    request.oncomplete = () => resolve()
    request.onerror = () => reject(request.error)
    request.onabort = () => reject(request.error)
  })
  storage.close()
}

export async function getCatalogDatabase(): Promise<Database | null> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const bytes = await readStoredDatabase()
      if (!bytes) return null
      const SQL = await initSqlJs({ locateFile: () => wasmUrl })
      return new SQL.Database(bytes)
    })()
  }

  return databasePromise
}

export async function replaceCatalogDatabase(bytes: Uint8Array): Promise<void> {
  await persistCatalogDatabase(bytes)
  databasePromise = null
}

export async function hasLocalCatalog(): Promise<boolean> {
  return Boolean(await readStoredDatabase())
}

export async function hasCompatibleCatalogDatabase(): Promise<boolean> {
  const database = await getCatalogDatabase()
  if (!database) return false

  const columns = new Set(
    (database.exec('PRAGMA table_info(cards)')[0]?.values ?? [])
      .map((row) => String(row[1])),
  )
  return REQUIRED_CATALOG_COLUMNS.every((column) => columns.has(column))
}

export async function listDecks(): Promise<Deck[]> {
  const storage = await openStorage()
  return new Promise((resolve, reject) => {
    const request = storage.transaction(DECKS_STORE, 'readonly')
      .objectStore(DECKS_STORE)
      .getAll()
    request.onsuccess = () => {
      storage.close()
      resolve((request.result as Deck[]) ?? [])
    }
    request.onerror = () => {
      storage.close()
      reject(request.error)
    }
  })
}

export async function getDeck(id: string): Promise<Deck | undefined> {
  const storage = await openStorage()
  return new Promise((resolve, reject) => {
    const request = storage.transaction(DECKS_STORE, 'readonly')
      .objectStore(DECKS_STORE)
      .get(id)
    request.onsuccess = () => {
      storage.close()
      resolve(request.result as Deck | undefined)
    }
    request.onerror = () => {
      storage.close()
      reject(request.error)
    }
  })
}

export async function saveDeck(deck: Deck): Promise<void> {
  const storage = await openStorage()
  await new Promise<void>((resolve, reject) => {
    const request = storage.transaction(DECKS_STORE, 'readwrite')
      .objectStore(DECKS_STORE)
      .put(deck)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
  storage.close()
}

export async function deleteDeck(id: string): Promise<void> {
  const storage = await openStorage()
  await new Promise<void>((resolve, reject) => {
    const request = storage.transaction(DECKS_STORE, 'readwrite')
      .objectStore(DECKS_STORE)
      .delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
  storage.close()
}
