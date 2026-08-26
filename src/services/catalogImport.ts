import type { CatalogArtifactMetadata, CatalogMetadata } from '../types/catalog'
import {
  hasLocalCatalog as hasStoredCatalog,
  persistCatalogMetadata,
  readCatalogMetadata,
  replaceCatalogDatabase,
} from '../db/sqliteClient'

export interface CatalogImportProgress {
  phase: string
  percent: number
}

async function readDatabaseBytes(source: Blob | ArrayBuffer): Promise<Uint8Array> {
  const bytes = source instanceof Blob
    ? new Uint8Array(await source.arrayBuffer())
    : new Uint8Array(source)

  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser does not support gzip database artifacts.')
  }

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function importCatalogArtifact(
  source: Blob | ArrayBuffer,
  artifact: CatalogArtifactMetadata,
  onProgress?: (progress: CatalogImportProgress) => void,
): Promise<void> {
  if (artifact.dbFormat !== 'sqlite') {
    throw new Error('The catalog artifact is not a SQLite database.')
  }

  onProgress?.({ phase: 'Reading SQLite database', percent: 10 })
  const bytes = await readDatabaseBytes(source)
  const checksum = await sha256(bytes)
  if (checksum !== artifact.databaseChecksum) {
    throw new Error('Catalog SQLite database checksum mismatch.')
  }

  onProgress?.({ phase: 'Validating SQLite database', percent: 50 })
  await replaceCatalogDatabase(bytes)
  await persistCatalogMetadata({
    id: 'catalog',
    schemaVersion: artifact.schemaVersion,
    artifactVersion: artifact.artifactVersion,
    generatedAt: artifact.generatedAt,
    sourceUpdatedAt: artifact.sourceUpdatedAt,
    checksum: artifact.databaseChecksum,
    databaseChecksum: artifact.databaseChecksum,
    cardCount: artifact.cardCount,
    importedAt: new Date().toISOString(),
  } satisfies CatalogMetadata)
  onProgress?.({ phase: 'Catalog ready', percent: 100 })
}

export async function hasLocalCatalog(): Promise<boolean> {
  return hasStoredCatalog()
}

export async function getCatalogMetadata(): Promise<CatalogMetadata | undefined> {
  return readCatalogMetadata<CatalogMetadata>()
}
