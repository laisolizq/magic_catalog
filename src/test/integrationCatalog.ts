import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import path from 'node:path'
import initSqlJs from 'sql.js'

import type { CatalogArtifactMetadata } from '../types/catalog'
import { importCatalogArtifact } from '../services/catalogImport'

const ARTIFACT_DIR = path.resolve(__dirname, '../../artifacts/card-database-test')

/**
 * Loads the frozen `card-database-test` release artifact (downloaded via
 * `npm run test:integration:fetch-db`) into the real import/persist path,
 * so integration tests exercise the same code as production.
 */
export async function loadIntegrationCatalog(): Promise<CatalogArtifactMetadata> {
  // sqliteClient.ts locates its wasm via a `?url` import that only resolves in a
  // browser/dev-server; priming sql.js with a real filesystem path here first
  // makes its module cache satisfy those later in-process initSqlJs() calls.
  await initSqlJs({
    locateFile: () => path.resolve('node_modules/sql.js/dist/sql-wasm.wasm'),
  })

  const metadataPath = path.join(ARTIFACT_DIR, 'metadata.json')
  const databasePath = path.join(ARTIFACT_DIR, 'catalog.sqlite.gz')

  let metadataText: string
  let compressedBytes: Buffer
  try {
    metadataText = readFileSync(metadataPath, 'utf-8')
    compressedBytes = readFileSync(databasePath)
  } catch {
    throw new Error(
      'Integration test database not found. Run `npm run test:integration:fetch-db` first.',
    )
  }

  const metadata = JSON.parse(metadataText) as CatalogArtifactMetadata
  // Decompress ourselves (Node's DecompressionStream support varies) and hand
  // importCatalogArtifact raw bytes; it only decompresses when it sees the gzip header.
  const rawBytes = gunzipSync(compressedBytes)
  await importCatalogArtifact(rawBytes.buffer.slice(
    rawBytes.byteOffset,
    rawBytes.byteOffset + rawBytes.byteLength,
  ) as ArrayBuffer, metadata)

  return metadata
}
