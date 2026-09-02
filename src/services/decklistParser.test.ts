import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { clearCatalogDatabase, getCatalogDatabase, replaceCatalogDatabase } from '../db/sqliteClient'
import { seedCatalogFixture } from '../test/catalogFixture'
import { parseDecklistLines, resolveDecklistLines } from './decklistParser'

beforeEach(() => seedCatalogFixture())
afterEach(() => clearCatalogDatabase())

// Adds two printings of the same card name (distinct set/collector_number)
// so pinned-printing resolution has something real to pick between.
async function seedDuplicatePrintings(): Promise<void> {
  const database = await getCatalogDatabase()
  if (!database) throw new Error('expected catalog database to be seeded')

  const faces = JSON.stringify([
    {
      name: 'Test Duplicate',
      manaCost: '{1}',
      typeLine: 'Instant',
      oracleText: '',
      colors: [],
      imageUrl: '',
    },
  ])

  database.run(
    'INSERT INTO cards (id, set_code, set_type, released_at, collector_number, oracle_id, rarity, faces_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ['dup-old', 'seta', 'expansion', '2020-01-01', '1', 'dup-oracle', 'common', faces],
  )
  database.run(
    'INSERT INTO cards (id, set_code, set_type, released_at, collector_number, oracle_id, rarity, faces_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ['dup-new', 'setb', 'expansion', '2024-01-01', '2', 'dup-oracle', 'common', faces],
  )

  await replaceCatalogDatabase(database.export())
}

describe('parseDecklistLines', () => {
  it('parses plain "qty name" lines', () => {
    expect(parseDecklistLines('4 Lightning Bolt')).toEqual([
      { quantity: 4, name: 'Lightning Bolt', setCode: undefined, collectorNumber: undefined, raw: '4 Lightning Bolt' },
    ])
  })

  it('parses "qtyx name" lines', () => {
    expect(parseDecklistLines('4x Lightning Bolt')).toEqual([
      { quantity: 4, name: 'Lightning Bolt', setCode: undefined, collectorNumber: undefined, raw: '4x Lightning Bolt' },
    ])
  })

  it('parses Arena-style set/collector-number suffixes', () => {
    expect(parseDecklistLines('4 Lightning Bolt (STA) 42')).toEqual([
      { quantity: 4, name: 'Lightning Bolt', setCode: 'sta', collectorNumber: '42', raw: '4 Lightning Bolt (STA) 42' },
    ])
  })

  it('skips blank lines', () => {
    expect(parseDecklistLines('4 Lightning Bolt\n\n  \n2 Sol Ring')).toHaveLength(2)
  })

  it('defaults to quantity 1 for a bare card name with no leading number', () => {
    expect(parseDecklistLines('Sol Ring')).toEqual([
      { quantity: 1, name: 'Sol Ring', raw: 'Sol Ring' },
    ])
  })
})

describe('resolveDecklistLines', () => {
  it('resolves an exact card name match', async () => {
    const { cards, unresolvedLines } = await resolveDecklistLines(
      parseDecklistLines('1 Old Thrush'),
    )

    expect(unresolvedLines).toEqual([])
    expect(cards).toEqual([{ cardId: 'hob-2', quantity: 1, rawName: 'Old Thrush' }])
  })

  it('resolves a misspelled name via the fuzzy index', async () => {
    const { cards, unresolvedLines } = await resolveDecklistLines(
      parseDecklistLines('1 Old Thrsh'),
    )

    expect(unresolvedLines).toEqual([])
    expect(cards).toEqual([{ cardId: 'hob-2', quantity: 1, rawName: 'Old Thrsh' }])
  })

  it('reports lines with no matching card as unresolved', async () => {
    const { cards, unresolvedLines } = await resolveDecklistLines(
      parseDecklistLines('3 Zzzznotacard'),
    )

    expect(cards).toEqual([])
    expect(unresolvedLines).toEqual([{ rawLine: '3 Zzzznotacard', reason: 'No matching card' }])
  })

  it('picks the latest printing by default when a name has multiple printings', async () => {
    await seedDuplicatePrintings()

    const { cards } = await resolveDecklistLines(parseDecklistLines('1 Test Duplicate'))

    expect(cards).toEqual([{ cardId: 'dup-new', quantity: 1, rawName: 'Test Duplicate' }])
  })

  it('honors an explicit pinned set/collector-number over the latest printing', async () => {
    await seedDuplicatePrintings()

    const { cards } = await resolveDecklistLines(
      parseDecklistLines('1 Test Duplicate (SETA) 1'),
    )

    expect(cards).toEqual([{ cardId: 'dup-old', quantity: 1, rawName: 'Test Duplicate' }])
  })
})
