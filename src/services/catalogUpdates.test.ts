import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CatalogMigration } from '../types/catalog'

const mocks = vi.hoisted(() => ({
  getCatalogMetadata: vi.fn(),
  importCatalogArtifact: vi.fn(),
  importCatalogMigrations: vi.fn(),
}))

vi.mock('../db/sqliteClient', () => ({
  clearCatalogDownloadCheckpoint: vi.fn(),
  persistCatalogDownloadCheckpoint: vi.fn(),
  readCatalogDownloadCheckpoint: vi.fn().mockResolvedValue(null),
}))

vi.mock('./catalogImport', () => ({
  getCatalogMetadata: mocks.getCatalogMetadata,
  importCatalogArtifact: mocks.importCatalogArtifact,
  importCatalogMigrations: mocks.importCatalogMigrations,
}))

import { findCatalogMigrationPath, updateCatalogFromLatestRelease } from './catalogUpdates'

function migration(baseChecksum: string, targetChecksum: string): CatalogMigration {
  return {
    baseChecksum,
    targetChecksum,
    generatedAt: '2026-09-21T00:00:00+00:00',
    commands: [`-- ${baseChecksum} to ${targetChecksum}`],
  }
}

describe('findCatalogMigrationPath', () => {
  it('finds a direct migration', () => {
    const direct = migration('old', 'latest')

    expect(findCatalogMigrationPath([direct], 'old', 'latest')).toEqual([direct])
  })

  it('finds a multi-step path through retained migrations', () => {
    const first = migration('old', 'middle')
    const second = migration('middle', 'latest')

    expect(findCatalogMigrationPath([second, first], 'old', 'latest')).toEqual([
      first,
      second,
    ])
  })

  it('returns undefined when the local revision is outside retained history', () => {
    expect(findCatalogMigrationPath(
      [migration('middle', 'latest')],
      'old',
      'latest',
    )).toBeUndefined()
  })

  it('does not loop on cyclic migration data', () => {
    expect(findCatalogMigrationPath(
      [migration('old', 'middle'), migration('middle', 'old')],
      'old',
      'latest',
    )).toBeUndefined()
  })
})

describe('updateCatalogFromLatestRelease', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCatalogMetadata.mockResolvedValue({
      checksum: 'old',
      databaseChecksum: 'old',
    })
    mocks.importCatalogMigrations.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('skips the full database download when an update path exists', async () => {
    const commands = ['BEGIN IMMEDIATE;', 'COMMIT;']
    const updateBytes = gzipSync(JSON.stringify({
      formatVersion: 1,
      historyDays: 14,
      migrations: [{
        baseChecksum: 'old',
        targetChecksum: 'latest',
        generatedAt: '2026-09-21T00:00:00+00:00',
        commands,
      }],
    }))
    const updateChecksum = createHash('sha256').update(updateBytes).digest('hex')
    const requestedUrls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      requestedUrls.push(url)
      if (url.endsWith('/metadata.json')) {
        return new Response(JSON.stringify({
          artifactVersion: '3',
          schemaVersion: 10,
          generatedAt: '2026-09-21T00:00:00+00:00',
          cardCount: 1,
          rulingsCount: 0,
          dbFormat: 'sqlite',
          databases: {
            full: {
              assetName: 'catalog.sqlite.gz',
              cardCount: 1,
              rulingsCount: 0,
              checksum: 'latest',
              compressedBytes: 1000,
              uncompressedBytes: 2000,
            },
          },
          updates: {
            assetName: 'catalog-updates.json.gz',
            format: 'sqlite-sql-json-gzip',
            formatVersion: 1,
            historyDays: 14,
            migrationCount: 1,
            latestBaseChecksum: 'old',
            targetChecksum: 'latest',
            checksum: updateChecksum,
            compressedBytes: updateBytes.byteLength,
            uncompressedBytes: 1,
          },
        }))
      }
      if (url.endsWith('/catalog-updates.json.gz')) {
        return new Response(updateBytes)
      }
      throw new Error(`Unexpected catalog download: ${url}`)
    }))

    await expect(updateCatalogFromLatestRelease()).resolves.toBe('updated')

    expect(mocks.importCatalogMigrations).toHaveBeenCalledWith(commands, expect.any(Object), undefined)
    expect(mocks.importCatalogArtifact).not.toHaveBeenCalled()
    expect(requestedUrls.some((url) => url.endsWith('/catalog.sqlite.gz'))).toBe(false)
  })
})
