import Fuse from 'fuse.js'

import { getCatalogDatabase } from '../db/sqliteClient'
import type { Card } from '../types/card'
import type { CatalogQuery, CatalogQueryResult, SetOption } from '../types/catalog'
import type { ColorCountOperator, ColorFilterMode } from '../utils/scryfallQuery'

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
    addedAt: row[8] ? String(row[8]) : undefined,
    legalities: row[9] ? (JSON.parse(String(row[9])) as Card['legalities']) : undefined,
  }
}

function cardSelectSql(database: NonNullable<Awaited<ReturnType<typeof getCatalogDatabase>>>): string {
  const columns = database.exec('PRAGMA table_info(cards)')[0]?.values ?? []
  const hasSetType = columns.some((column) => column[1] === 'set_type')
  const hasReleaseDate = columns.some((column) => column[1] === 'released_at')
  const hasAddedDate = columns.some((column) => column[1] === 'added_at')
  const hasLegalities = columns.some((column) => column[1] === 'legalities_json')
  return `SELECT id, set_code, ${hasSetType ? 'set_type' : "''"}, ${hasReleaseDate ? 'released_at' : "''"}, collector_number, oracle_id, rarity, faces_json, ${hasAddedDate ? 'added_at' : "''"}, ${hasLegalities ? 'legalities_json' : "''"}
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
    const selectedCount = selectedWubrg.length

    // exactly: face colors === selected. including: face colors ⊇ selected.
    // atMost: face colors ⊆ selected. moreThan/lessThan are the strict
    // (proper superset/subset) versions of including/atMost. not: face
    // colors !== selected. Colorless faces (0 colors) are a subset of
    // anything, so they're matched separately below since they have no
    // face_colors rows.
    const havingClause =
      colorMode === 'including'
        ? `${matchCount} = ${selectedCount}`
        : colorMode === 'atMost'
          ? `COUNT(*) = ${matchCount}`
          : colorMode === 'moreThan'
            ? `${matchCount} = ${selectedCount} AND COUNT(*) > ${selectedCount}`
            : colorMode === 'lessThan'
              ? `COUNT(*) = ${matchCount} AND COUNT(*) < ${selectedCount}`
              : colorMode === 'not'
                ? `NOT (COUNT(*) = ${selectedCount} AND ${matchCount} = ${selectedCount})`
                : `COUNT(*) = ${selectedCount} AND ${matchCount} = ${selectedCount}`

    fragments.push(
      `EXISTS (SELECT 1 FROM face_colors WHERE card_id = cards.id GROUP BY face_index HAVING ${havingClause})`,
    )
    params.push(...selectedWubrg)

    // A colorless face is a subset of every color set, so it also satisfies
    // atMost/lessThan (0 colors), and it's never equal to a non-empty
    // selected set, so it also satisfies "not".
    const alsoMatchesColorless =
      colorMode === 'atMost' || colorMode === 'lessThan' || colorMode === 'not'

    if (alsoMatchesColorless && !colors.includes('C')) {
      fragments.push(COLORLESS_FACE_FRAGMENT)
    }
  }

  if (fragments.length === 0) return null
  return { sql: `(${fragments.join(' OR ')})`, params }
}

// A face's color count is its face_colors row count (0 for colorless faces,
// which never appear as a GROUP BY group - see COLORLESS_FACE_FRAGMENT).
// Matches the "any face matches" semantics used by buildColorCondition.
function buildColorCountCondition(operator: ColorCountOperator, value: number): SqlCondition {
  if (!Number.isInteger(value) || value < 0) {
    return { sql: '0', params: [] }
  }

  if (value === 0) {
    switch (operator) {
      case '=':
      case '<=':
        return { sql: `(${COLORLESS_FACE_FRAGMENT})`, params: [] }
      case '!=':
      case '>':
        return {
          sql: 'EXISTS (SELECT 1 FROM face_colors WHERE card_id = cards.id)',
          params: [],
        }
      case '>=':
        return { sql: '1', params: [] }
      case '<':
        return { sql: '0', params: [] }
    }
  }

  // value >= 1: a colorless face (count 0) also satisfies !=, < and <=.
  const coloredFaceMatch =
    `EXISTS (SELECT 1 FROM face_colors WHERE card_id = cards.id GROUP BY face_index HAVING COUNT(*) ${operator} ${value})`

  const alsoMatchesColorless =
    operator === '!=' || operator === '<' || operator === '<='

  return {
    sql: alsoMatchesColorless
      ? `(${coloredFaceMatch} OR ${COLORLESS_FACE_FRAGMENT})`
      : coloredFaceMatch,
    params: [],
  }
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

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&')
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
  const databaseStartedAt = performance.now()
  const database = await getCatalogDatabase()
  console.log(`[catalog] database ready in ${(performance.now() - databaseStartedAt).toFixed(0)}ms`)
  if (!database) return { cards: [], total: 0 }

  // Let the browser paint the latest input before synchronous SQLite work.
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0))

  resetCacheIfDatabaseChanged(database as unknown as object)

  const hasSetFilter = hasFilterValues(query.sets)
  const hasRarityFilter = hasFilterValues(query.rarities)
  const hasTypeFilter = hasFilterValues(query.types)
  const hasColorFilter = hasFilterValues(query.colors)
  const hasColorCountFilter = query.colorCount != null
  const hasCardIdsFilter = (query.cardIds?.length ?? 0) > 0
  const text = query.text.trim()
  const oracle = query.oracle?.trim() ?? ''
  const hasText = text.length > 0
  const hasOracleFilter = oracle.length > 0

  if (!hasSetFilter && !hasRarityFilter && !hasTypeFilter && !hasColorFilter && !hasColorCountFilter && !hasOracleFilter && !hasCardIdsFilter) {
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
    colorCount: query.colorCount,
    oracle,
    cardIds: query.cardIds,
  })
  let cards = cachedFilterResults.get(filterKey)

  if (!cards) {
  const sqlStartedAt = performance.now()
  const conditions: string[] = []
  const parameters: string[] = []

  if (hasCardIdsFilter) {
    const names = query.cardIds!.map(() => '?')
    query.cardIds!.forEach((id) => parameters.push(id))
    conditions.push(`id IN (${names.join(', ')})`)
  }

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

  if (query.colorCount) {
    const colorCountCondition = buildColorCountCondition(
      query.colorCount.operator,
      query.colorCount.value,
    )
    conditions.push(colorCountCondition.sql)
    parameters.push(...colorCountCondition.params)
  }

  if (hasOracleFilter) {
    conditions.push(`EXISTS (
      SELECT 1
      FROM json_each(cards.faces_json) AS face
      WHERE lower(COALESCE(json_extract(face.value, '$.oracleText'), ''))
        LIKE '%' || lower(?) || '%' ESCAPE '\\'
    )`)
    parameters.push(escapeLikePattern(oracle))
  }

  const result = database.exec(
    `${cardSelectSql(database)}${conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''}`,
    parameters,
  )
    console.log(`[catalog] SQLite query completed in ${(performance.now() - sqlStartedAt).toFixed(0)}ms`)

    const mappingStartedAt = performance.now()
    cards = (result[0]?.values ?? []).map(rowToCard)
    console.log(`[catalog] SQLite rows mapped in ${(performance.now() - mappingStartedAt).toFixed(0)}ms`)

    cachedFilterResults.set(filterKey, cards)
  }

  const fuse = getFilterFuse(filterKey, cards)
  if (!hasText) return { cards, total: cards.length }

  const searchStartedAt = performance.now()
  const searchedCards = searchCards(fuse, cards, text)
  console.log(`[catalog] SQLite Fuse search completed in ${(performance.now() - searchStartedAt).toFixed(0)}ms`)
  return { cards: searchedCards, total: searchedCards.length }
}

// Used by decklist import to resolve a pasted card name to a printing.
// Exact (case-insensitive) face-name matches are preferred and sorted
// newest-first; falls back to the fuzzy index for typos/partial names.
export async function findCardPrintings(name: string): Promise<Card[]> {
  const database = await getCatalogDatabase()
  if (!database) return []

  resetCacheIfDatabaseChanged(database as unknown as object)

  const cards = await getAllCards(database)
  const normalizedName = name.trim().toLowerCase()
  if (!normalizedName) return []

  const exactMatches = cards.filter((card) =>
    card.faces.some((face) => face.name.trim().toLowerCase() === normalizedName),
  )

  if (exactMatches.length > 0) {
    return [...exactMatches].sort((left, right) =>
      (right.releasedAt ?? '').localeCompare(left.releasedAt ?? ''),
    )
  }

  const fuse = getAllCardsFuse(cards)
  const fuzzyMatches = searchCards(fuse, cards, name)
  return fuzzyMatches.length > 0 ? [fuzzyMatches[0]] : []
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

// Older cached databases (generated before the sets table existed, or
// before it had a set_type column) simply have no set names/icons/types to
// offer - degrade gracefully rather than throwing on a missing table/column.
function getSetsTableColumns(database: NonNullable<Awaited<ReturnType<typeof getCatalogDatabase>>>): Set<string> {
  const rows = database.exec('PRAGMA table_info(sets)')[0]?.values ?? []
  return new Set(rows.map((row) => String(row[1])))
}

export async function getCatalogSetOptions(): Promise<SetOption[]> {
  const database = await getCatalogDatabase()
  if (!database) return []

  const columns = getSetsTableColumns(database)
  if (!columns.has('code') || !columns.has('name')) return []

  const hasSetType = columns.has('set_type')
  const rows = database.exec(
    `SELECT code, name, ${hasSetType ? 'set_type' : "''"}, released_at FROM sets ORDER BY released_at DESC`,
  )[0]?.values ?? []

  return rows.map((row) => ({
    code: String(row[0]),
    name: String(row[1]),
    setType: String(row[2] ?? ''),
    releasedAt: String(row[3] ?? ''),
  }))
}
