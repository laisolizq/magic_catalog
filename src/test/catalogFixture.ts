import initSqlJs from 'sql.js'
import path from 'node:path'

import { mockCards } from '../data/mockCards'
import type { Card } from '../types/card'
import { persistCatalogMetadata, replaceCatalogDatabase } from '../db/sqliteClient'
import { selectLatestPrintings } from '../pages/CatalogPage/selectLatestPrintings'

// Real set names/types, matching Scryfall, for the sets present in
// mockCards.ts (which doesn't carry a setType field on its cards).
const SET_NAMES: Record<string, string> = {
  tla: 'Avatar: The Last Airbender',
  hob: 'The Hobbit',
  sos: 'Secrets of Strixhaven',
  tle: 'Avatar: The Last Airbender Eternal',
}

const SET_TYPES: Record<string, string> = {
  tla: 'expansion',
  hob: 'expansion',
  sos: 'expansion',
  tle: 'eternal',
}

// Mirrors manaValueFromCost in CatalogPage.tsx / mana_value_from_cost in
// generate_card_database.py.
function manaValueFromCost(cost: string): number {
  if (!cost) return 0
  const symbols = Array.from(cost.matchAll(/\{([^}]+)\}/g), (m) => m[1])
  return symbols.reduce((total, symbol) => {
    if (/^\d+$/.test(symbol)) return total + Number(symbol)
    if (symbol === 'X' || symbol === 'Y' || symbol === 'Z') return total
    if (symbol.includes('/')) return total + (symbol.startsWith('2/') ? 2 : 1)
    if (symbol === 'H') return total + 1
    if (/^H[WUBRG]$/.test(symbol)) return total + 0.5
    if (/^[WUBRGCSPL]$/.test(symbol)) return total + 1
    return total
  }, 0)
}

// Mirrors collectorSortKey in CatalogPage.tsx / collector_sort_key in
// generate_card_database.py.
function collectorSortKey(value: string | undefined): [number, string] {
  const match = value?.match(/^(\d+)(.*)$/)
  if (!match) return [Number.MAX_SAFE_INTEGER, value ?? '']
  return [Number(match[1]), match[2].toLowerCase()]
}

export async function seedCatalogFixture(): Promise<void> {
  await seedCards(mockCards)
}

// Lower-level fixture builder for tests that need custom cards/set metadata
// (e.g. exercising dedup tie-break rules) instead of the fixed mockCards set.
export async function seedCards(
  cards: Card[],
  setMeta: Record<string, { name?: string; setType?: string; releasedAt?: string }> = {},
): Promise<void> {
  const SQL = await initSqlJs({
    locateFile: () => path.resolve('node_modules/sql.js/dist/sql-wasm.wasm'),
  })
  const database = new SQL.Database()
  database.exec(`
    CREATE TABLE cards (id TEXT PRIMARY KEY, set_code TEXT NOT NULL, set_type TEXT NOT NULL DEFAULT '', released_at TEXT NOT NULL DEFAULT '', collector_number TEXT, oracle_id TEXT, rarity TEXT NOT NULL, faces_json TEXT NOT NULL, added_at TEXT NOT NULL DEFAULT '', primary_face_name TEXT NOT NULL DEFAULT '', primary_mana_value REAL NOT NULL DEFAULT 0, collector_number_numeric INTEGER NOT NULL DEFAULT 9007199254740991, collector_number_suffix TEXT NOT NULL DEFAULT '', is_preferred_printing INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE face_types (card_id TEXT, face_index INTEGER, type_name TEXT, PRIMARY KEY (card_id, face_index, type_name));
    CREATE TABLE face_subtypes (card_id TEXT, face_index INTEGER, subtype_name TEXT, PRIMARY KEY (card_id, face_index, subtype_name));
    CREATE TABLE face_colors (card_id TEXT, face_index INTEGER, color TEXT, PRIMARY KEY (card_id, face_index, color));
    CREATE TABLE rulings (oracle_id TEXT, object TEXT, source TEXT, published_at TEXT, comment TEXT);
    CREATE TABLE sets (code TEXT PRIMARY KEY, name TEXT NOT NULL, set_type TEXT NOT NULL DEFAULT '', released_at TEXT NOT NULL DEFAULT '');
    CREATE INDEX cards_set_idx ON cards(set_code);
    CREATE INDEX cards_rarity_idx ON cards(rarity);
    CREATE INDEX cards_primary_face_name_idx ON cards(primary_face_name);
    CREATE INDEX face_types_name_idx ON face_types(type_name);
    CREATE INDEX face_subtypes_name_idx ON face_subtypes(subtype_name);
    CREATE INDEX face_colors_color_idx ON face_colors(color);
    CREATE INDEX rulings_oracle_idx ON rulings(oracle_id, published_at);
    CREATE INDEX sets_released_at_idx ON sets(released_at);
  `)

  const insertCard = database.prepare('INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
  const insertType = database.prepare('INSERT OR IGNORE INTO face_types VALUES (?, ?, ?)')
  const insertSubtype = database.prepare('INSERT OR IGNORE INTO face_subtypes VALUES (?, ?, ?)')
  const insertColor = database.prepare('INSERT OR IGNORE INTO face_colors VALUES (?, ?, ?)')
  const insertSet = database.prepare('INSERT OR IGNORE INTO sets VALUES (?, ?, ?, ?)')

  // Reference implementation (not a re-port) so the fixture's dedup column
  // always matches whatever selectLatestPrintings.ts actually does.
  const preferredIds = new Set(selectLatestPrintings(cards).map((card) => card.id))

  for (const card of cards) {
    const primaryFace = card.faces[0]
    const [collectorNumeric, collectorSuffix] = collectorSortKey(card.collectorNumber)
    insertCard.run([
      card.id,
      card.set,
      card.setType ?? '',
      card.releasedAt ?? '',
      card.collectorNumber ?? '',
      card.oracleId ?? '',
      card.rarity,
      JSON.stringify(card.faces),
      card.addedAt ?? '',
      primaryFace?.name ?? '',
      manaValueFromCost(primaryFace?.manaCost ?? ''),
      collectorNumeric,
      collectorSuffix,
      preferredIds.has(card.id) ? 1 : 0,
    ])
    card.faces.forEach((face, faceIndex) => {
      const [mainPart, subtypePart] = face.typeLine.split('\u2014')
      mainPart.trim().toLowerCase().split(/\s+/).forEach((type) => {
        if (!['legendary', 'basic', 'snow', 'world', 'ongoing'].includes(type)) {
          insertType.run([card.id, faceIndex, type])
        }
      })
      ;(subtypePart ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean).forEach((subtype) => {
        insertSubtype.run([card.id, faceIndex, subtype])
      })
      face.colors.forEach((color) => insertColor.run([card.id, faceIndex, color]))
    })
    const overrides = setMeta[card.set]
    insertSet.run([
      card.set,
      overrides?.name ?? SET_NAMES[card.set] ?? card.set,
      card.setType ?? overrides?.setType ?? SET_TYPES[card.set] ?? '',
      card.releasedAt ?? overrides?.releasedAt ?? '',
    ])
  }

  insertCard.free()
  insertType.free()
  insertSubtype.free()
  insertColor.free()
  insertSet.free()
  const bytes = database.export()
  database.close()
  await replaceCatalogDatabase(bytes)
  await persistCatalogMetadata({
    id: 'catalog',
    schemaVersion: 5,
    artifactVersion: 'test',
    generatedAt: new Date().toISOString(),
    databaseChecksum: 'test',
    checksum: 'test',
    cardCount: cards.length,
    importedAt: new Date().toISOString(),
  })
}
