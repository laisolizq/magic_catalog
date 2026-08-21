import initSqlJs, { type Database } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'

const DATABASE_NAME = 'magic-catalog-sqlite'
const DATABASE_STORE = 'database'
const DATABASE_KEY = 'catalog'

let databasePromise: Promise<Database | null> | null = null

function openStorage(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(DATABASE_STORE)
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
