import type { Card, CardColor } from './card'
import type { ColorCountFilter, ColorFilterMode } from '../utils/scryfallQuery'

export const CATALOG_SCHEMA_VERSION = 5
export const CATALOG_METADATA_ID = 'catalog'

export interface StoredCard extends Card {
  searchText: string
  faceNames: string[]
}

export interface FaceIndex {
  id?: number
  cardId: string
  faceIndex: number
  name: string
  typeLine: string
  typeTokens: string[]
  colors: CardColor[]
}

export interface StoredRuling {
  id?: number
  oracleId: string
  object: string
  oracle_id: string
  source: string
  published_at: string
  comment: string
}

export interface CatalogMetadata {
  id: typeof CATALOG_METADATA_ID
  schemaVersion: number
  artifactVersion: string
  generatedAt: string
  sourceUpdatedAt?: string
  checksum?: string
  cardCount: number
  importedAt: string
  databaseChecksum?: string
}

export interface CatalogArtifactMetadata {
  artifactVersion: string
  schemaVersion: number
  generatedAt: string
  sourceUpdatedAt?: string
  rulingsSourceUpdatedAt?: string
  cardCount: number
  rulingsCount: number
  dbFormat: 'sqlite'
  // Legacy fields (for backward compatibility)
  databaseAssetName?: string
  databaseChecksum?: string
  databaseCompressedBytes?: number
  databaseUncompressedBytes?: number
  // New structure: multiple databases
  databases?: {
    full?: {
      assetName: string
      cardCount: number
      rulingsCount: number
      checksum: string
      compressedBytes: number
      uncompressedBytes: number
    }
    recent?: {
      assetName: string
      cardCount: number
      rulingsCount: number
      checksum: string
      compressedBytes: number
      uncompressedBytes: number
      description?: string
      cutoffDate?: string
    }
  }
}

export interface CatalogQuery {
  text: string
  oracle?: string
  sets: string[]
  types: string[]
  rarities: string[]
  colors: string[]
  colorMode: ColorFilterMode
  colorCount?: ColorCountFilter | null
  cardIds?: string[]
}

export interface SetOption {
  code: string
  name: string
  releasedAt: string
  setType: string
}

export interface CatalogQueryResult {
  cards: Card[]
  total: number
}
