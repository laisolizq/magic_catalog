import type { CatalogArtifactMetadata } from '../types/catalog'
import {
  clearCatalogDownloadCheckpoint,
  persistCatalogDownloadCheckpoint,
  readCatalogDownloadCheckpoint,
} from '../db/sqliteClient'
import {
  getCatalogMetadata,
  importCatalogArtifact,
  type CatalogImportProgress,
} from './catalogImport'

const RELEASE_API_URL =
  'https://api.github.com/repos/laisolizq/magic_catalog/releases/tags/card-database-latest'
const BOOTSTRAP_DATABASE_URL = import.meta.env.VITE_CATALOG_BOOTSTRAP_DATABASE_URL
const BOOTSTRAP_METADATA_URL = import.meta.env.VITE_CATALOG_BOOTSTRAP_METADATA_URL
const PAGES_ARTIFACT_BASE_URL = 'https://laisolizq.github.io/magic_catalog/card-database'
const PAGES_DATABASE_URL = `${PAGES_ARTIFACT_BASE_URL}/catalog.sqlite.gz`
const PAGES_METADATA_URL = `${PAGES_ARTIFACT_BASE_URL}/metadata.json`
const PAGES_BOOTSTRAP_DATABASE_URL = `${PAGES_ARTIFACT_BASE_URL}/catalog-recent.sqlite.gz`
const LOCAL_DATABASE_URL = import.meta.env.VITE_CATALOG_DATABASE_URL
const LOCAL_METADATA_URL = import.meta.env.VITE_CATALOG_METADATA_URL
const LOCAL_BOOTSTRAP_DATABASE_URL = import.meta.env.VITE_CATALOG_BOOTSTRAP_DATABASE_URL
const LOCAL_BOOTSTRAP_METADATA_URL = import.meta.env.VITE_CATALOG_BOOTSTRAP_METADATA_URL

interface GitHubReleaseAsset {
  id?: number
  name: string
  browser_download_url: string
}

interface GitHubRelease {
  tag_name: string
  assets: GitHubReleaseAsset[]
}

export type CatalogUpdateStatus =
  | 'offline'
  | 'up-to-date'
  | 'updated'
  | 'unavailable'
  | 'failed'

export async function bootstrapCatalogFromEmbeddedAssets(
  onProgress?: (progress: CatalogImportProgress) => void,
): Promise<CatalogUpdateStatus> {
  onProgress?.({ database: 'recent', phase: 'Preparing recent database', percent: 0 })

  if (BOOTSTRAP_DATABASE_URL && BOOTSTRAP_METADATA_URL) {
    return updateFromLocalArtifact(
      BOOTSTRAP_DATABASE_URL,
      BOOTSTRAP_METADATA_URL,
      onProgress,
      'recent',
    )
  }

  if (LOCAL_BOOTSTRAP_DATABASE_URL && LOCAL_BOOTSTRAP_METADATA_URL) {
    return updateFromLocalArtifact(
      LOCAL_BOOTSTRAP_DATABASE_URL,
      LOCAL_BOOTSTRAP_METADATA_URL,
      onProgress,
      'recent',
    )
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline'

  try {
    const pagesStatus = await updateFromLocalArtifact(
      PAGES_BOOTSTRAP_DATABASE_URL,
      PAGES_METADATA_URL,
      onProgress,
      'recent',
    )
    if (pagesStatus !== 'unavailable') return pagesStatus

    return await updateFromGitHubRelease(
      (metadata) => metadata.databases?.recent?.assetName || 'catalog-recent.sqlite.gz',
      onProgress,
    )
  } catch (error) {
    console.error('[catalog] bootstrap failed', error)
    return 'failed'
  }
}

function findAsset(release: GitHubRelease, name: string): GitHubReleaseAsset | undefined {
  return release.assets.find((asset) => asset.name === name)
}

function isNewer(
  local: Awaited<ReturnType<typeof getCatalogMetadata>>,
  remote: CatalogArtifactMetadata,
): boolean {
  return !local || local.checksum !== remote.databaseChecksum
}

function logCompleted(label: string, startedAt: number): void {
  console.log(`[catalog] ${label} completed in ${(performance.now() - startedAt).toFixed(0)}ms`)
}

function logDatabaseDownload(
  metadata: CatalogArtifactMetadata,
  source: string,
): void {
  console.info('[catalog] downloading SQLite database', {
    assetName: metadata.databaseAssetName,
    artifactVersion: metadata.artifactVersion,
    generatedAt: metadata.generatedAt,
    checksum: metadata.databaseChecksum?.slice(0, 12),
    source,
  })
}

function metadataForDatabase(
  metadata: CatalogArtifactMetadata,
  database: 'full' | 'recent',
): CatalogArtifactMetadata {
  const selected = metadata.databases?.[database]
  if (!selected) return metadata

  return {
    ...metadata,
    cardCount: selected.cardCount,
    rulingsCount: selected.rulingsCount,
    databaseAssetName: selected.assetName,
    databaseChecksum: selected.checksum,
    databaseCompressedBytes: selected.compressedBytes,
    databaseUncompressedBytes: selected.uncompressedBytes,
  }
}

type DownloadProgress = (percent: number) => void

async function responseToBlob(
  response: Response,
  onProgress?: DownloadProgress,
  expectedBytes?: number,
  prefix = new Uint8Array() as unknown as Uint8Array<ArrayBuffer>,
  checkpointKey?: string,
): Promise<Blob> {
  const reader = response.body?.getReader()
  if (!reader) {
    const blob = await response.blob()
    onProgress?.(100)
    return blob
  }

  const contentLength = Number(response.headers.get('content-length'))
  const totalBytes = Number.isFinite(contentLength) && contentLength > 0
    ? contentLength + prefix.byteLength
    : expectedBytes
  const chunks: Uint8Array[] = [prefix]
  let receivedBytes = prefix.byteLength
  let persistedBytes = prefix.byteLength
  let pendingBytes = 0
  let lastPercent = -1

  const reportProgress = () => {
    if (!totalBytes) return
    const percent = Math.min(99, Math.floor((receivedBytes / totalBytes) * 100))
    if (percent === lastPercent) return
    lastPercent = percent
    onProgress?.(percent)
  }

  try {
    while (true) {
      const result = await reader.read()
      if (result.done) break
      chunks.push(new Uint8Array(result.value) as unknown as Uint8Array<ArrayBuffer>)
      receivedBytes += result.value.byteLength
      pendingBytes += result.value.byteLength
      reportProgress()
      if (checkpointKey && pendingBytes >= 4 * 1024 * 1024) {
        await persistCatalogDownloadCheckpoint(checkpointKey, {
          bytes: concatBytes(chunks),
          totalBytes,
        })
        persistedBytes = receivedBytes
        pendingBytes = 0
      }
    }
  } finally {
    reader.releaseLock()
  }

  onProgress?.(100)
  if (checkpointKey && receivedBytes > persistedBytes) {
    await persistCatalogDownloadCheckpoint(checkpointKey, {
      bytes: concatBytes(chunks),
      totalBytes,
    })
  }
  return new Blob(
    chunks as unknown as BlobPart[],
    { type: response.headers.get('content-type') || 'application/octet-stream' },
  )
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const bytes = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0))
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

async function fetchArtifactBlob(
  url: string,
  onProgress?: DownloadProgress,
  expectedBytes?: number,
  checkpointKey?: string,
): Promise<Blob> {
  let lastError: unknown

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const checkpoint = checkpointKey
        ? await readCatalogDownloadCheckpoint(checkpointKey)
        : null
      const resumeBytes = (checkpoint?.bytes ?? new Uint8Array()) as unknown as Uint8Array<ArrayBuffer>
      const response = await fetch(url, {
        cache: 'no-store',
        headers: resumeBytes.byteLength > 0
          ? { Range: `bytes=${resumeBytes.byteLength}-` }
          : undefined,
      })
      if (!response.ok) throw new Error(`Artifact request failed with HTTP ${response.status}`)
      const canResume = resumeBytes.byteLength > 0 && response.status === 206
      const blob = await responseToBlob(
        response,
        onProgress,
        expectedBytes,
        canResume ? resumeBytes : new Uint8Array(),
        checkpointKey,
      )
      if (checkpointKey) await clearCatalogDownloadCheckpoint(checkpointKey)
      return blob
    } catch (error) {
      lastError = error
      if (attempt === 2) throw lastError
      console.warn(`[catalog] retrying artifact download: ${url}`)
    }
  }

  throw lastError
}

async function fetchReleaseAssetBlob(
  asset: GitHubReleaseAsset,
  onProgress?: DownloadProgress,
  expectedBytes?: number,
  checkpointKey?: string,
): Promise<Blob> {
  if (typeof asset.id !== 'number') {
    return fetchArtifactBlob(asset.browser_download_url, onProgress, expectedBytes, checkpointKey)
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const checkpoint = checkpointKey
        ? await readCatalogDownloadCheckpoint(checkpointKey)
        : null
      const resumeBytes = (checkpoint?.bytes ?? new Uint8Array()) as unknown as Uint8Array<ArrayBuffer>
      const response = await fetch(
        `https://api.github.com/repos/laisolizq/magic_catalog/releases/assets/${asset.id}`,
        {
          cache: 'no-store',
          headers: {
            Accept: 'application/octet-stream',
            ...(resumeBytes.byteLength > 0
              ? { Range: `bytes=${resumeBytes.byteLength}-` }
              : {}),
          },
        },
      )
      if (!response.ok) {
        throw new Error(`Release asset request failed with HTTP ${response.status}`)
      }
      const canResume = resumeBytes.byteLength > 0 && response.status === 206
      const blob = await responseToBlob(
        response,
        onProgress,
        expectedBytes,
        canResume ? resumeBytes : new Uint8Array(),
        checkpointKey,
      )
      if (checkpointKey) await clearCatalogDownloadCheckpoint(checkpointKey)
      return blob
    } catch (error) {
      void error
      if (attempt === 2) break
      console.warn(`[catalog] retrying release asset download: ${asset.name}`)
    }
  }

  console.warn(`[catalog] release asset API fetch failed; falling back to browser URL for ${asset.name}`)
  return fetchArtifactBlob(asset.browser_download_url, onProgress, expectedBytes, checkpointKey)
}

async function updateFromLocalArtifact(
  databaseUrl: string,
  metadataUrl: string,
  onProgress?: (progress: CatalogImportProgress) => void,
  database: 'full' | 'recent' = 'full',
): Promise<CatalogUpdateStatus> {
  const updateStartedAt = performance.now()
  const metadataStartedAt = performance.now()
  const metadataResponse = await fetch(metadataUrl, { cache: 'no-store' })
  if (!metadataResponse.ok) return 'unavailable'
  logCompleted('metadata download', metadataStartedAt)

  const metadata = metadataForDatabase(
    (await metadataResponse.json()) as CatalogArtifactMetadata,
    database,
  )
  const local = await getCatalogMetadata()
  if (!isNewer(local, metadata)) return 'up-to-date'

  logDatabaseDownload(metadata, databaseUrl)
  const databaseStartedAt = performance.now()
  const reportDownloadProgress = (percent: number) => {
    onProgress?.({ database, phase: 'Downloading database', percent })
  }
  reportDownloadProgress(0)
  const checkpointKey = `catalog:${database}:${metadata.databaseChecksum}`
  const databaseBlob = await fetchArtifactBlob(
    databaseUrl,
    reportDownloadProgress,
    metadata.databaseCompressedBytes,
    checkpointKey,
  )
  logCompleted('SQLite database download', databaseStartedAt)

  const importStartedAt = performance.now()
  await importCatalogArtifact(
    databaseBlob,
    metadata,
    onProgress,
    database,
  )
  logCompleted('SQLite catalog import', importStartedAt)
  logCompleted('catalog update', updateStartedAt)
  return 'updated'
}

async function updateFromGitHubRelease(
  selectDatabaseAssetName: (metadata: CatalogArtifactMetadata) => string,
  onProgress?: (progress: CatalogImportProgress) => void,
): Promise<CatalogUpdateStatus> {
  const response = await fetch(RELEASE_API_URL, {
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (!response.ok) return 'unavailable'

  const release = (await response.json()) as GitHubRelease
  const metadataAsset = findAsset(release, 'metadata.json')
  if (!metadataAsset) return 'unavailable'

  const metadataStartedAt = performance.now()
  const metadataBlob = await fetchReleaseAssetBlob(metadataAsset)
  logCompleted('metadata download', metadataStartedAt)
  const metadata = JSON.parse(await metadataBlob.text()) as CatalogArtifactMetadata

  const databaseAssetName = selectDatabaseAssetName(metadata)
  const databaseAsset = findAsset(release, databaseAssetName)
  if (!databaseAsset) return 'unavailable'
  const local = await getCatalogMetadata()

  if (!isNewer(local, metadata)) return 'up-to-date'

  logDatabaseDownload(metadata, databaseAsset.browser_download_url)
  const databaseStartedAt = performance.now()
  const reportDownloadProgress = (percent: number) => {
    onProgress?.({ database: 'full', phase: 'Downloading database', percent })
  }
  reportDownloadProgress(0)
  const checkpointKey = `catalog:full:${metadata.databaseChecksum}`
  const databaseBlob = await fetchReleaseAssetBlob(
    databaseAsset,
    reportDownloadProgress,
    metadata.databaseCompressedBytes,
    checkpointKey,
  )
  logCompleted('SQLite database download', databaseStartedAt)

  const importStartedAt = performance.now()
  await importCatalogArtifact(
    databaseBlob,
    { ...metadata, artifactVersion: metadata.artifactVersion || release.tag_name },
    onProgress,
    'full',
  )
  logCompleted('SQLite catalog import', importStartedAt)
  return 'updated'
}

export async function updateCatalogFromLatestRelease(
  onProgress?: (progress: CatalogImportProgress) => void,
): Promise<CatalogUpdateStatus> {
  const updateStartedAt = performance.now()
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'offline'

  try {
    if (LOCAL_DATABASE_URL && LOCAL_METADATA_URL) {
      const status = await updateFromLocalArtifact(
        LOCAL_DATABASE_URL,
        LOCAL_METADATA_URL,
        onProgress,
      )
      if (status !== 'updated') logCompleted(`catalog update (${status})`, updateStartedAt)
      return status
    }

    const pagesStatus = await updateFromLocalArtifact(
      PAGES_DATABASE_URL,
      PAGES_METADATA_URL,
      onProgress,
    )
    if (pagesStatus !== 'unavailable') {
      if (pagesStatus !== 'updated') logCompleted(`catalog update (${pagesStatus})`, updateStartedAt)
      return pagesStatus
    }

    const status = await updateFromGitHubRelease(
      (metadata) => metadata.databases?.full?.assetName || metadata.databaseAssetName || 'catalog.sqlite.gz',
      onProgress,
    )
    logCompleted('catalog update', updateStartedAt)
    return status
  } catch (error) {
    console.error('[catalog] update failed', error)
    return 'failed'
  }
}
