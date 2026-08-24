import Fuse from 'fuse.js'

import { getCatalogDatabase } from '../db/sqliteClient'
import type { Card } from '../types/card'
import type { CatalogQuery, CatalogQueryResult } from '../types/catalog'
import type { ColorFilterMode } from '../utils/scryfallQuery'

let cachedDatabaseRef: object | null = null
let cachedAllCards: Card[] | null = null
type SearchIndexEntry = {
  card: Card
  searchName: string
}

let cachedAllCardsFuse: Fuse<SearchIndexEntry> | null = null
const cachedFilterResults = new Map<string, Card[]>()
const cachedFilterFuse = new Map<string, Fuse<SearchIndexEntry>>()

function rowToCard(row: unknown[]): Card {
  return {
    id: String(row[0]),
    set: String(row[1]),
    setType: row[2] ? String(row[2]) : undefined,
    releasedAt: row[3] ? String(row[3]) : undefined,
    collectorNumber: row[4] ? String(row[4]) : undefined,
    oracleId: row[5] ? String(row[5]) : undefined,
    rarity: row[6] as Card['rarity'],
    faces: JSON.parse(String(row[7])) as Card['faces'],
  }
}

function cardSelectSql(database: NonNullable<Awaited<ReturnType<typeof getCatalogDatabase>>>): string {
  const columns = database.exec('PRAGMA table_info(cards)')[0]?.values ?? []
  const hasSetType = columns.some((column) => column[1] === 'set_type')
  const hasReleaseDate = columns.some((column) => column[1] === 'released_at')
  return `SELECT id, set_code, ${hasSetType ? 'set_type' : "''"}, ${hasReleaseDate ? 'released_at' : "''"}, collector_number, oracle_id, rarity, faces_json
     FROM cards`
}

interface SqlCondition {
  sql: string
  params: string[]
}

// face_types stores one row per exact lowercased main-type token per face, and
// face_subtypes stores subtype tokens (e.g. "Dragon" in "Creature — Dragon"),
// see generate_card_database.py. Matching either lets t:dragon-style queries work.
function buildTypeCondition(types: string[]): SqlCondition {
  const placeholders = types.map(() => '?').join(', ')
  const params = types.map((type) => type.toLowerCase())
  return {
    sql: `id IN (
      SELECT DISTINCT card_id FROM face_types WHERE type_name IN (${placeholders})
      UNION
      SELECT DISTINCT card_id FROM face_subtypes WHERE subtype_name IN (${placeholders})
    )`,
    params: [...params, ...params],
  }
}

// A colorless face has no rows at all, so compare colored-face count against total faces.
const COLORLESS_FACE_FRAGMENT =
  '(SELECT COUNT(DISTINCT face_index) FROM face_colors WHERE card_id = cards.id) < json_array_length(cards.faces_json)'

// Mirrors the previous cardColorsMatchFace semantics (any face matches), but expressed
// as SQL over face_colors (one row per face/color) instead of decoding faces_json in JS.
function buildColorCondition(colors: string[], colorMode: ColorFilterMode): SqlCondition | null {
  const selectedWubrg = colors.filter((color) => color !== 'C' && color !== 'M')
  const fragments: string[] = []
  const params: string[] = []

  if (colors.includes('C')) {
    fragments.push(COLORLESS_FACE_FRAGMENT)
  }

  if (colors.includes('M')) {
    fragments.push(
      'EXISTS (SELECT 1 FROM face_colors WHERE card_id = cards.id GROUP BY face_index HAVING COUNT(*) > 1)',
    )
  }

  if (selectedWubrg.length > 0) {
    const placeholders = selectedWubrg.map(() => '?').join(', ')
    const matchCount = `SUM(CASE WHEN color IN (${placeholders}) THEN 1 ELSE 0 END)`

    // exactly: face colors === selected. including: face colors ⊇ selected.
    // atMost: face colors ⊆ selected (colorless faces are a subset of anything,
    // so they're matched separately below since they have no face_colors rows).
    const havingClause =
      colorMode === 'including'
        ? `${matchCount} = ${selectedWubrg.length}`
        : colorMode === 'atMost'
          ? `COUNT(*) = ${matchCount}`
          : `COUNT(*) = ${selectedWubrg.length} AND ${matchCount} = ${selectedWubrg.length}`

    fragments.push(
      `EXISTS (SELECT 1 FROM face_colors WHERE card_id = cards.id GROUP BY face_index HAVING ${havingClause})`,
    )
    params.push(...selectedWubrg)

    if (colorMode === 'atMost' && !colors.includes('C')) {
      fragments.push(COLORLESS_FACE_FRAGMENT)
    }
  }

  if (fragments.length === 0) return null
  return { sql: `(${fragments.join(' OR ')})`, params }
}

function resetCacheIfDatabaseChanged(database: object): void {
  if (cachedDatabaseRef === database) return
  cachedDatabaseRef = database
  cachedAllCards = null
  cachedAllCardsFuse = null
  cachedFilterResults.clear()
  cachedFilterFuse.clear()
}

function hasFilterValues(values: string[]): boolean {
  return values.length > 0 && !values.includes('all')
}

async function getAllCards(database: NonNullable<Awaited<ReturnType<typeof getCatalogDatabase>>>): Promise<Card[]> {
  if (cachedAllCards) return cachedAllCards

  const startedAt = performance.now()
  const result = database.exec(
    cardSelectSql(database),
  )
  cachedAllCards = (result[0]?.values ?? []).map(rowToCard)
  console.log(`[catalog] cached ${cachedAllCards.length} cards in ${(performance.now() - startedAt).toFixed(0)}ms`)
  return cachedAllCards
}

function createSearchIndexEntries(cards: Card[]): SearchIndexEntry[] {
  return cards.map((card) => ({
    card,
    searchName: card.faces
      .map((face) => normalizeSearchText(face.name))
      .join(' '),
  }))
}

function getAllCardsFuse(cards: Card[]): Fuse<SearchIndexEntry> {
  if (cachedAllCardsFuse) return cachedAllCardsFuse

  const startedAt = performance.now()
  cachedAllCardsFuse = new Fuse(createSearchIndexEntries(cards), {
    keys: ['searchName'],
    includeScore: true,
    threshold: 0.35,
    ignoreLocation: true,
    minMatchCharLength: 2,
  })
  console.log(`[catalog] cached Fuse index built for ${cards.length} cards in ${(performance.now() - startedAt).toFixed(0)}ms`)
  return cachedAllCardsFuse
}

function getFilterFuse(filterKey: string, cards: Card[]): Fuse<SearchIndexEntry> {
  const cachedFuse = cachedFilterFuse.get(filterKey)
  if (cachedFuse) return cachedFuse

  const startedAt = performance.now()
  const fuse = new Fuse(createSearchIndexEntries(cards), {
    keys: ['searchName'],
    includeScore: true,
    threshold: 0.35,
    ignoreLocation: true,
    minMatchCharLength: 2,
  })
  cachedFilterFuse.set(filterKey, fuse)
  console.log(`[catalog] SQLite Fuse index built for ${cards.length} cards in ${(performance.now() - startedAt).toFixed(0)}ms`)
  return fuse
}

function normalizeSearchText(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function searchCards(
  fuse: Fuse<SearchIndexEntry>,
  cards: Card[],
  text: string,
): Card[] {
  const normalizedQuery = normalizeSearchText(text)
  if (!normalizedQuery) return cards

  const results = fuse.search(normalizedQuery, { limit: cards.length })
  return results
    .sort((left, right) => {
      const leftStartsWith = left.item.searchName.startsWith(normalizedQuery)
      const rightStartsWith = right.item.searchName.startsWith(normalizedQuery)

      if (leftStartsWith !== rightStartsWith) {
        return leftStartsWith ? -1 : 1
      }

      return (left.score ?? 0) - (right.score ?? 0)
    })
    .map((result) => result.item.card)
}

export async function queryCards(query: CatalogQuery): Promise<CatalogQueryResult> {
  const database = await getCatalogDatabase()
  if (!database) return { cards: [], total: 0 }

  // Let the browser paint the latest input before synchronous SQLite work.
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0))

  resetCacheIfDatabaseChanged(database as unknown as object)

  const hasSetFilter = hasFilterValues(query.sets)
  const hasRarityFilter = hasFilterValues(query.rarities)
  const hasTypeFilter = hasFilterValues(query.types)
  const hasColorFilter = hasFilterValues(query.colors)
  const text = query.text.trim()
  const hasText = text.length > 0

  if (!hasSetFilter && !hasRarityFilter && !hasTypeFilter && !hasColorFilter) {
    const cards = await getAllCards(database)
    const fuse = getAllCardsFuse(cards)
    if (!hasText) return { cards, total: cards.length }

    const searchStartedAt = performance.now()
    const searchedCards = searchCards(fuse, cards, text)
    console.log(`[catalog] cached Fuse search completed in ${(performance.now() - searchStartedAt).toFixed(0)}ms`)
    return { cards: searchedCards, total: searchedCards.length }
  }

  const filterKey = JSON.stringify({
    sets: query.sets,
    rarities: query.rarities,
    types: query.types,
    colors: query.colors,
    colorMode: query.colorMode,
  })
  let cards = cachedFilterResults.get(filterKey)

  if (!cards) {
  const conditions: string[] = []
  const parameters: string[] = []

  if (hasSetFilter) {
    const names = query.sets.map(() => '?')
    query.sets.forEach((set) => parameters.push(set))
    conditions.push(`set_code IN (${names.join(', ')})`)
  }

  if (hasRarityFilter) {
    const names = query.rarities.map(() => '?')
    query.rarities.forEach((rarity) => parameters.push(rarity))
    conditions.push(`rarity IN (${names.join(', ')})`)
  }

  if (hasTypeFilter) {
    const typeCondition = buildTypeCondition(query.types)
    conditions.push(typeCondition.sql)
    parameters.push(...typeCondition.params)
  }

  if (hasColorFilter) {
    const colorCondition = buildColorCondition(query.colors, query.colorMode ?? 'exactly')
    if (colorCondition) {
      conditions.push(colorCondition.sql)
      parameters.push(...colorCondition.params)
    }
  }

  const result = database.exec(
    `${cardSelectSql(database)}${conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''}`,
    parameters,
  )
    cards = (result[0]?.values ?? []).map(rowToCard)

    cachedFilterResults.set(filterKey, cards)
  }

  const fuse = getFilterFuse(filterKey, cards)
  if (!hasText) return { cards, total: cards.length }

  const searchStartedAt = performance.now()
  const searchedCards = searchCards(fuse, cards, text)
  console.log(`[catalog] SQLite Fuse search completed in ${(performance.now() - searchStartedAt).toFixed(0)}ms`)
  return { cards: searchedCards, total: searchedCards.length }
}

export async function getCatalogSets(): Promise<string[]> {
  const database = await getCatalogDatabase()
  if (!database) return []
  return (database.exec('SELECT DISTINCT set_code FROM cards ORDER BY set_code')[0]?.values ?? [])
    .map((row) => String(row[0]))
}

export async function getCatalogTypes(): Promise<string[]> {
  const database = await getCatalogDatabase()
  if (!database) return []
  return (database.exec('SELECT DISTINCT type_name FROM face_types ORDER BY type_name')[0]?.values ?? [])
    .map((row) => String(row[0]))
}
