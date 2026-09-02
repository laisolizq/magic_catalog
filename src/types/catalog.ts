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
  // Opt-in SQL-side sort/dedup/pagination (see sqliteCardQuery.ts). Ignored
  // (falls back to returning every matching row) when text is non-empty or
  // the loaded database predates the sort/dedup columns.
  sortOption?: CatalogSortOption
  // Defaults to true (no dedup) so callers that don't pass it keep getting
  // every printing, matching pre-pagination behavior.
  showAllPrints?: boolean
  limit?: number
  offset?: number
}

// Structurally identical to (but intentionally decoupled from) the SortOption
// unions in CatalogPage.tsx/SearchBar.tsx/DeckViewPage.tsx.
export type CatalogSortOption =
  | 'default'
  | 'set-asc'
  | 'set-desc'
  | 'name-asc'
  | 'name-desc'
  | 'cmc-asc'
  | 'cmc-desc'
  | 'added-asc'
  | 'added-desc'

export interface SetOption {
  code: string
  name: string
  releasedAt: string
  setType: string
}

export interface CatalogQueryResult {
  cards: Card[]
  total: number
  // True when sort/dedup/pagination ran in SQL (so the caller shouldn't
  // re-run selectLatestPrintings/sortCards/slicing in JS). False for the
  // legacy path (free-text search, or a database without the sort columns).
  serverPaginated?: boolean
}
