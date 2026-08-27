import initSqlJs, { type Database } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'

import type { Deck } from '../types/deck'

const DATABASE_NAME = 'magic-catalog-sqlite'
const DATABASE_VERSION = 2
const DATABASE_STORE = 'database'
const DATABASE_KEY = 'catalog'
const DECKS_STORE = 'decks'

let databasePromise: Promise<Database | null> | null = null

function openStorage(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(DATABASE_STORE)) db.createObjectStore(DATABASE_STORE)
      if (!db.objectStoreNames.contains(DECKS_STORE)) db.createObjectStore(DECKS_STORE, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
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
      .objectStore(DATABASE_STORE)
      .delete(DATABASE_KEY)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
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
  const SQL = await initSqlJs({ locateFile: () => wasmUrl })
  const nextDatabase = new SQL.Database(bytes)
  nextDatabase.exec('PRAGMA integrity_check')
  nextDatabase.close()

  await persistCatalogDatabase(bytes)
  databasePromise = Promise.resolve(new SQL.Database(bytes))
}

export async function hasLocalCatalog(): Promise<boolean> {
  return Boolean(await readStoredDatabase())
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
