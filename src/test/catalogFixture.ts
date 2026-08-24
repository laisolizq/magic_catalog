import initSqlJs from 'sql.js'
import path from 'node:path'

import { mockCards } from '../data/mockCards'
import { persistCatalogMetadata, replaceCatalogDatabase } from '../db/sqliteClient'

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

export async function seedCatalogFixture(): Promise<void> {
  const SQL = await initSqlJs({
    locateFile: () => path.resolve('node_modules/sql.js/dist/sql-wasm.wasm'),
  })
  const database = new SQL.Database()
  database.exec(`
    CREATE TABLE cards (id TEXT PRIMARY KEY, set_code TEXT NOT NULL, set_type TEXT NOT NULL DEFAULT '', released_at TEXT NOT NULL DEFAULT '', collector_number TEXT, oracle_id TEXT, rarity TEXT NOT NULL, faces_json TEXT NOT NULL);
    CREATE TABLE face_types (card_id TEXT, face_index INTEGER, type_name TEXT, PRIMARY KEY (card_id, face_index, type_name));
    CREATE TABLE face_subtypes (card_id TEXT, face_index INTEGER, subtype_name TEXT, PRIMARY KEY (card_id, face_index, subtype_name));
    CREATE TABLE face_colors (card_id TEXT, face_index INTEGER, color TEXT, PRIMARY KEY (card_id, face_index, color));
    CREATE TABLE rulings (oracle_id TEXT, object TEXT, source TEXT, published_at TEXT, comment TEXT);
    CREATE TABLE sets (code TEXT PRIMARY KEY, name TEXT NOT NULL, set_type TEXT NOT NULL DEFAULT '', released_at TEXT NOT NULL DEFAULT '');
    CREATE INDEX cards_set_idx ON cards(set_code);
    CREATE INDEX cards_rarity_idx ON cards(rarity);
    CREATE INDEX face_types_name_idx ON face_types(type_name);
    CREATE INDEX face_subtypes_name_idx ON face_subtypes(subtype_name);
    CREATE INDEX face_colors_color_idx ON face_colors(color);
    CREATE INDEX rulings_oracle_idx ON rulings(oracle_id, published_at);
    CREATE INDEX sets_released_at_idx ON sets(released_at);
  `)

  const insertCard = database.prepare('INSERT INTO cards VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
  const insertType = database.prepare('INSERT OR IGNORE INTO face_types VALUES (?, ?, ?)')
  const insertSubtype = database.prepare('INSERT OR IGNORE INTO face_subtypes VALUES (?, ?, ?)')
  const insertColor = database.prepare('INSERT OR IGNORE INTO face_colors VALUES (?, ?, ?)')
  const insertSet = database.prepare('INSERT OR IGNORE INTO sets VALUES (?, ?, ?, ?)')

  for (const card of mockCards) {
    insertCard.run([
      card.id,
      card.set,
      card.setType ?? '',
      card.releasedAt ?? '',
      card.collectorNumber ?? '',
      card.oracleId ?? '',
      card.rarity,
      JSON.stringify(card.faces),
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
    insertSet.run([
      card.set,
      SET_NAMES[card.set] ?? card.set,
      card.setType ?? SET_TYPES[card.set] ?? '',
      card.releasedAt ?? '',
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
    cardCount: mockCards.length,
    importedAt: new Date().toISOString(),
  })
}
