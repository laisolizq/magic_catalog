import Fuse from 'fuse.js'

import { getCatalogDatabase } from '../db/sqliteClient'
import type { Card, CardColor } from '../types/card'
import type { CatalogQuery, CatalogQueryResult } from '../types/catalog'
import { cardColorsMatchFace } from '../utils/cardColors'

let cachedDatabaseRef: object | null = null
let cachedAllCards: Card[] | null = null
let cachedAllCardsFuse: Fuse<Card> | null = null
const cachedFilterResults = new Map<string, Card[]>()
const cachedFilterFuse = new Map<string, Fuse<Card>>()

function rowToCard(row: unknown[]): Card {
  return {
    id: String(row[0]),
    set: String(row[1]),
    collectorNumber: row[2] ? String(row[2]) : undefined,
    oracleId: row[3] ? String(row[3]) : undefined,
    rarity: row[4] as Card['rarity'],
    faces: JSON.parse(String(row[5])) as Card['faces'],
  }
}

function faceMatchesType(card: Card, types: string[]): boolean {
  const normalizedTypes = types.map((type) => type.toLowerCase())
  return card.faces.some((face) => {
    const typeLine = face.typeLine.toLowerCase()
    return normalizedTypes.some((type) => typeLine.includes(type))
  })
}

function faceMatchesColor(card: Card, colors: string[]): boolean {
  return card.faces.some((face) => cardColorsMatchFace(face.colors as CardColor[], colors))
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
    `SELECT id, set_code, collector_number, oracle_id, rarity, faces_json
     FROM cards`,
  )
  cachedAllCards = (result[0]?.values ?? []).map(rowToCard)
  console.log(`[catalog] cached ${cachedAllCards.length} cards in ${(performance.now() - startedAt).toFixed(0)}ms`)
  return cachedAllCards
}

function getAllCardsFuse(cards: Card[]): Fuse<Card> {
  if (cachedAllCardsFuse) return cachedAllCardsFuse

  const startedAt = performance.now()
  cachedAllCardsFuse = new Fuse(cards, {
    keys: ['faces.name'],
    threshold: 0.35,
    ignoreLocation: true,
    minMatchCharLength: 2,
  })
  console.log(`[catalog] cached Fuse index built for ${cards.length} cards in ${(performance.now() - startedAt).toFixed(0)}ms`)
  return cachedAllCardsFuse
}

function getFilterFuse(filterKey: string, cards: Card[]): Fuse<Card> {
  const cachedFuse = cachedFilterFuse.get(filterKey)
  if (cachedFuse) return cachedFuse

  const startedAt = performance.now()
  const fuse = new Fuse(cards, {
    keys: ['faces.name'],
    threshold: 0.35,
    ignoreLocation: true,
    minMatchCharLength: 2,
  })
  cachedFilterFuse.set(filterKey, fuse)
  console.log(`[catalog] SQLite Fuse index built for ${cards.length} cards in ${(performance.now() - startedAt).toFixed(0)}ms`)
  return fuse
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
    const searchedCards = fuse.search(text).map((item) => item.item)
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

  const result = database.exec(
    `SELECT id, set_code, collector_number, oracle_id, rarity, faces_json
     FROM cards${conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''}`,
    parameters,
  )
    cards = (result[0]?.values ?? []).map(rowToCard)

    if (hasTypeFilter) {
      cards = cards.filter((card) => faceMatchesType(card, query.types))
    }

    if (hasColorFilter) {
      cards = cards.filter((card) => faceMatchesColor(card, query.colors))
    }

    cachedFilterResults.set(filterKey, cards)
  }

  const fuse = getFilterFuse(filterKey, cards)
  if (!hasText) return { cards, total: cards.length }

  const searchStartedAt = performance.now()
  const searchedCards = fuse.search(text).map((item) => item.item)
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
