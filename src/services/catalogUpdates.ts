import type { CatalogArtifactMetadata } from '../types/catalog'
import {
  getCatalogMetadata,
  importCatalogArtifact,
  type CatalogImportProgress,
} from './catalogImport'

const RELEASE_API_URL =
  'https://api.github.com/repos/laisolizq/magic_catalog/releases/tags/card-database-latest'
const BOOTSTRAP_BASE_URL = `${import.meta.env.BASE_URL}card-database/bootstrap`
const BOOTSTRAP_DATABASE_URL =
  import.meta.env.VITE_CATALOG_BOOTSTRAP_DATABASE_URL || `${BOOTSTRAP_BASE_URL}/catalog-recent.sqlite.gz`
const BOOTSTRAP_METADATA_URL =
  import.meta.env.VITE_CATALOG_BOOTSTRAP_METADATA_URL || `${BOOTSTRAP_BASE_URL}/metadata.json`
const PAGES_ARTIFACT_BASE_URL = 'https://laisolizq.github.io/magic_catalog/card-database'
const PAGES_DATABASE_URL = `${PAGES_ARTIFACT_BASE_URL}/catalog.sqlite.gz`
const PAGES_METADATA_URL = `${PAGES_ARTIFACT_BASE_URL}/metadata.json`
const LOCAL_DATABASE_URL = import.meta.env.VITE_CATALOG_DATABASE_URL
const LOCAL_METADATA_URL = import.meta.env.VITE_CATALOG_METADATA_URL

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
  onProgress?.({ phase: 'Loading starter catalog', percent: 5 })
  return updateFromLocalArtifact(
    BOOTSTRAP_DATABASE_URL,
    BOOTSTRAP_METADATA_URL,
    onProgress,
  )
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

async function fetchArtifactBlob(url: string): Promise<Blob> {
  let lastError: unknown

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(url, {
        cache: 'no-store',
      })
      if (!response.ok) throw new Error(`Artifact request failed with HTTP ${response.status}`)
      return await response.blob()
    } catch (error) {
      lastError = error
      if (attempt === 2) throw lastError
      console.warn(`[catalog] retrying artifact download: ${url}`)
    }
  }

  throw lastError
}

async function fetchReleaseAssetBlob(asset: GitHubReleaseAsset): Promise<Blob> {
  if (typeof asset.id !== 'number') {
    return fetchArtifactBlob(asset.browser_download_url)
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/laisolizq/magic_catalog/releases/assets/${asset.id}`,
        {
          cache: 'no-store',
          headers: {
            Accept: 'application/octet-stream',
          },
        },
      )
      if (!response.ok) {
        throw new Error(`Release asset request failed with HTTP ${response.status}`)
      }
      return await response.blob()
    } catch (error) {
      void error
      if (attempt === 2) break
      console.warn(`[catalog] retrying release asset download: ${asset.name}`)
    }
  }

  console.warn(`[catalog] release asset API fetch failed; falling back to browser URL for ${asset.name}`)
  return fetchArtifactBlob(asset.browser_download_url)
}

async function updateFromLocalArtifact(
  databaseUrl: string,
  metadataUrl: string,
  onProgress?: (progress: CatalogImportProgress) => void,
): Promise<CatalogUpdateStatus> {
  const updateStartedAt = performance.now()
  const metadataStartedAt = performance.now()
  const metadataResponse = await fetch(metadataUrl, { cache: 'no-store' })
  if (!metadataResponse.ok) return 'unavailable'
  logCompleted('metadata download', metadataStartedAt)

  const metadata = (await metadataResponse.json()) as CatalogArtifactMetadata
  const local = await getCatalogMetadata()
  if (!isNewer(local, metadata)) return 'up-to-date'

  const databaseStartedAt = performance.now()
  const databaseBlob = await fetchArtifactBlob(databaseUrl)
  logCompleted('SQLite database download', databaseStartedAt)
  onProgress?.({ phase: 'Downloading SQLite database', percent: 15 })

  const importStartedAt = performance.now()
  await importCatalogArtifact(
    databaseBlob,
    metadata,
    onProgress,
  )
  logCompleted('SQLite catalog import', importStartedAt)
  logCompleted('catalog update', updateStartedAt)
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
    
    // Prefer full database, fall back to legacy databaseAssetName
    const databaseAssetName = metadata.databases?.full?.assetName || metadata.databaseAssetName || 'catalog.sqlite.gz'
    const databaseAsset = findAsset(release, databaseAssetName)
    if (!databaseAsset) return 'unavailable'
    const local = await getCatalogMetadata()

    if (!isNewer(local, metadata)) return 'up-to-date'

    const databaseStartedAt = performance.now()
    const databaseBlob = await fetchReleaseAssetBlob(databaseAsset)
    logCompleted('SQLite database download', databaseStartedAt)
    onProgress?.({ phase: 'Downloading SQLite database', percent: 15 })

    const importStartedAt = performance.now()
    await importCatalogArtifact(
      databaseBlob,
      { ...metadata, artifactVersion: metadata.artifactVersion || release.tag_name },
      onProgress,
    )
    logCompleted('SQLite catalog import', importStartedAt)
    logCompleted('catalog update', updateStartedAt)

    return 'updated'
  } catch (error) {
    console.error('[catalog] update failed', error)
    return 'failed'
  }
}
