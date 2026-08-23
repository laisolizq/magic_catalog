import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { clearCatalogDatabase } from '../db/sqliteClient'
import { loadIntegrationCatalog } from '../test/integrationCatalog'
import { INTEGRATION_QUERY_CASES } from '../test/integrationQueries'
import { queryCards } from './sqliteCardQuery'

// Only fail on results that are drastically slow; exact thresholds vary by
// hardware, so this is a smoke ceiling rather than a strict perf budget.
const SOFT_CEILING_MS = 3000

interface TimingRecord {
  name: string
  elapsedMs: number
  count: number
}

const timings: TimingRecord[] = []

describe('queryCards against the real card-database-test catalog', () => {
  beforeAll(async () => {
    await loadIntegrationCatalog()
  }, 60_000)

  afterAll(async () => {
    console.table(
      timings.map((timing) => ({
        query: timing.name,
        'elapsed (ms)': timing.elapsedMs.toFixed(0),
        results: timing.count,
      })),
    )
    await clearCatalogDatabase()
  })

  for (const { name, filters } of INTEGRATION_QUERY_CASES) {
    it(`${name} returns results within the soft ceiling`, async () => {
      const startedAt = performance.now()
      const result = await queryCards(filters)
      const elapsedMs = performance.now() - startedAt

      timings.push({ name, elapsedMs, count: result.cards.length })

      if (filters.sets.length > 0) {
        expect(result.cards.every((card) => filters.sets.includes(card.set))).toBe(true)
      }
      if (filters.rarities.length > 0) {
        expect(result.cards.every((card) => filters.rarities.includes(card.rarity))).toBe(true)
      }
      if (filters.types.length > 0) {
        const normalizedTypes = filters.types.map((type) => type.toLowerCase())
        expect(
          result.cards.every((card) =>
            card.faces.some((face) =>
              normalizedTypes.some((type) => face.typeLine.toLowerCase().includes(type)),
            ),
          ),
        ).toBe(true)
      }

      expect(result.cards.length).toBeGreaterThan(0)
      expect(elapsedMs).toBeLessThan(SOFT_CEILING_MS)
    })
  }
})
