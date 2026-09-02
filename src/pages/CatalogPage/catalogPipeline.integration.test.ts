import { describe, expect, it } from 'vitest'

import { clearCatalogDatabase } from '../../db/sqliteClient'
import { loadIntegrationCatalog } from '../../test/integrationCatalog'
import { queryCards } from '../../services/sqliteCardQuery'
import { selectLatestPrintings } from './selectLatestPrintings'
import { sortCards } from './CatalogPage'

// Smoke ceiling, not a strict budget - exact numbers vary by hardware.
const SOFT_CEILING_MS = 3000

describe('catalog display pipeline (browse all, show all prints off, sort added-desc)', () => {
  it('queries, deduplicates to latest printings, and sorts within the soft ceiling', async () => {
    await loadIntegrationCatalog()

    const queryStartedAt = performance.now()
    const result = await queryCards({
      text: '',
      sets: [],
      types: [],
      rarities: [],
      colors: [],
      colorMode: 'exactly',
    })
    const queryElapsedMs = performance.now() - queryStartedAt

    const dedupeStartedAt = performance.now()
    const latestPrintings = selectLatestPrintings(result.cards)
    const dedupeElapsedMs = performance.now() - dedupeStartedAt

    const sortStartedAt = performance.now()
    const sorted = sortCards(latestPrintings, 'added-desc')
    const sortElapsedMs = performance.now() - sortStartedAt

    console.table([
      { stage: 'queryCards (browse all)', 'elapsed (ms)': queryElapsedMs.toFixed(0), count: result.cards.length },
      { stage: 'selectLatestPrintings', 'elapsed (ms)': dedupeElapsedMs.toFixed(0), count: latestPrintings.length },
      { stage: 'sortCards (added-desc)', 'elapsed (ms)': sortElapsedMs.toFixed(0), count: sorted.length },
    ])

    expect(sorted.length).toBeGreaterThan(0)
    expect(sorted.length).toBeLessThanOrEqual(result.cards.length)
    expect(queryElapsedMs + dedupeElapsedMs + sortElapsedMs).toBeLessThan(SOFT_CEILING_MS)

    await clearCatalogDatabase()
  }, 60_000)

  it('the SQL sort + pagination path (showAllPrints: true, no dedup) is dramatically faster', async () => {
    await loadIntegrationCatalog()

    const legacyStartedAt = performance.now()
    const legacyResult = await queryCards({
      text: '',
      sets: [],
      types: [],
      rarities: [],
      colors: [],
      colorMode: 'exactly',
    })
    const legacySorted = sortCards(legacyResult.cards, 'added-desc')
    const legacyElapsedMs = performance.now() - legacyStartedAt

    // Same query, but SQL does the ORDER BY + LIMIT, so only the first
    // page's faces_json ever gets parsed instead of all 105k rows.
    const serverStartedAt = performance.now()
    const serverResult = await queryCards({
      text: '',
      sets: [],
      types: [],
      rarities: [],
      colors: [],
      colorMode: 'exactly',
      showAllPrints: true,
      sortOption: 'added-desc',
      limit: 12,
    })
    const serverElapsedMs = performance.now() - serverStartedAt

    console.table([
      { pipeline: 'legacy (fetch all + JS sort)', 'elapsed (ms)': legacyElapsedMs.toFixed(0), count: legacySorted.length },
      { pipeline: 'SQL (sort + LIMIT 12, no dedup)', 'elapsed (ms)': serverElapsedMs.toFixed(0), count: serverResult.cards.length },
    ])

    expect(serverResult.serverPaginated).toBe(true)
    expect(serverResult.cards.length).toBe(12)
    // Same added_at values (and thus SQL's "COLLATE NOCASE" vs JS's
    // localeCompare name tie-break) can order same-date cards differently,
    // so compare the set of top-12 ids rather than their exact order.
    expect(new Set(serverResult.cards.map((card) => card.id))).toEqual(
      new Set(legacySorted.slice(0, 12).map((card) => card.id)),
    )
    expect(serverElapsedMs).toBeLessThan(legacyElapsedMs)

    await clearCatalogDatabase()
  }, 60_000)

  it('the SQL dedup + sort + pagination path (showAllPrints: false, schema v9+ is_preferred_printing) is dramatically faster', async () => {
    await loadIntegrationCatalog()

    // Legacy 3-stage pipeline (fetch everything, JS dedupe, JS sort).
    const legacyStartedAt = performance.now()
    const legacyResult = await queryCards({
      text: '',
      sets: [],
      types: [],
      rarities: [],
      colors: [],
      colorMode: 'exactly',
    })
    const legacySorted = sortCards(selectLatestPrintings(legacyResult.cards), 'added-desc')
    const legacyElapsedMs = performance.now() - legacyStartedAt

    // Same query, but "preferred printing" per card name was precomputed at
    // generation time (generate_card_database.py's compute_preferred_printings)
    // so dedup here is just `WHERE is_preferred_printing = 1`, same cost as
    // the plain sort+pagination case above - no window-function query needed.
    const serverStartedAt = performance.now()
    const serverResult = await queryCards({
      text: '',
      sets: [],
      types: [],
      rarities: [],
      colors: [],
      colorMode: 'exactly',
      showAllPrints: false,
      sortOption: 'added-desc',
      limit: 12,
    })
    const serverElapsedMs = performance.now() - serverStartedAt

    console.table([
      { pipeline: 'legacy (fetch all + JS dedupe + JS sort)', 'elapsed (ms)': legacyElapsedMs.toFixed(0), count: legacySorted.length },
      { pipeline: 'SQL (is_preferred_printing=1 + sort + LIMIT 12)', 'elapsed (ms)': serverElapsedMs.toFixed(0), count: serverResult.cards.length },
    ])

    expect(serverResult.serverPaginated).toBe(true)
    expect(serverResult.cards.length).toBe(12)
    expect(new Set(serverResult.cards.map((card) => card.id))).toEqual(
      new Set(legacySorted.slice(0, 12).map((card) => card.id)),
    )
    expect(serverElapsedMs).toBeLessThan(legacyElapsedMs)

    await clearCatalogDatabase()
  }, 60_000)

  it('dedup is also correct for a small filtered candidate pool (single set)', async () => {
    await loadIntegrationCatalog()

    const legacyResult = await queryCards({
      text: '',
      sets: ['bro'],
      types: [],
      rarities: [],
      colors: [],
      colorMode: 'exactly',
    })
    const legacySorted = sortCards(selectLatestPrintings(legacyResult.cards), 'added-desc')

    const serverResult = await queryCards({
      text: '',
      sets: ['bro'],
      types: [],
      rarities: [],
      colors: [],
      colorMode: 'exactly',
      showAllPrints: false,
      sortOption: 'added-desc',
      limit: 12,
    })

    expect(serverResult.serverPaginated).toBe(true)
    expect(new Set(serverResult.cards.map((card) => card.id))).toEqual(
      new Set(legacySorted.slice(0, 12).map((card) => card.id)),
    )

    await clearCatalogDatabase()
  }, 60_000)
})
