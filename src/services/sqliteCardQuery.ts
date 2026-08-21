import Fuse from 'fuse.js'

import { getCatalogDatabase } from '../db/sqliteClient'
import type { Card, CardColor } from '../types/card'
import type { CatalogQuery, CatalogQueryResult } from '../types/catalog'
import { cardColorsMatchFace } from '../utils/cardColors'

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

export async function queryCards(query: CatalogQuery): Promise<CatalogQueryResult> {
  const database = await getCatalogDatabase()
  if (!database) return { cards: [], total: 0 }

  const conditions: string[] = []
  const parameters: string[] = []

  if (query.sets.length > 0 && !query.sets.includes('all')) {
    const names = query.sets.map(() => '?')
    query.sets.forEach((set) => parameters.push(set))
    conditions.push(`set_code IN (${names.join(', ')})`)
  }

  if (query.rarities.length > 0 && !query.rarities.includes('all')) {
    const names = query.rarities.map(() => '?')
    query.rarities.forEach((rarity) => parameters.push(rarity))
    conditions.push(`rarity IN (${names.join(', ')})`)
  }

  const result = database.exec(
    `SELECT id, set_code, collector_number, oracle_id, rarity, faces_json
     FROM cards${conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''}`,
    parameters,
  )
  let cards = (result[0]?.values ?? []).map(rowToCard)

  if (query.types.length > 0 && !query.types.includes('all')) {
    cards = cards.filter((card) => faceMatchesType(card, query.types))
  }

  if (query.colors.length > 0 && !query.colors.includes('all')) {
    cards = cards.filter((card) => faceMatchesColor(card, query.colors))
  }

  const text = query.text.trim()
  if (text) {
    const fuseStartedAt = performance.now()
    const fuse = new Fuse(cards, {
      keys: ['faces.name'],
      threshold: 0.35,
      ignoreLocation: true,
      minMatchCharLength: 2,
    })
    console.log(`[catalog] SQLite Fuse index built for ${cards.length} cards in ${(performance.now() - fuseStartedAt).toFixed(0)}ms`)
    const searchStartedAt = performance.now()
    cards = fuse.search(text).map((item) => item.item)
    console.log(`[catalog] SQLite Fuse search completed in ${(performance.now() - searchStartedAt).toFixed(0)}ms`)
  }

  return { cards, total: cards.length }
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
