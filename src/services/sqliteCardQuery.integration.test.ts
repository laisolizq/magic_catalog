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

// Independent re-check of buildColorCondition's SQL semantics (any face: exact WUBRG
// set match, colorless = no colors, multicolor = more than one color).
function faceMatchesColors(faceColors: string[], selected: string[]): boolean {
  const selectedWubrg = selected.filter((color) => color !== 'C' && color !== 'M')
  return (
    (selected.includes('C') && faceColors.length === 0) ||
    (selected.includes('M') && faceColors.length > 1) ||
    (selectedWubrg.length > 0 &&
      faceColors.length === selectedWubrg.length &&
      selectedWubrg.every((color) => faceColors.includes(color)))
  )
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
      if (filters.colors.length > 0) {
        expect(result.cards.every((card) => card.faces.some((face) => faceMatchesColors(face.colors, filters.colors)))).toBe(true)
      }

      expect(result.cards.length).toBeGreaterThan(0)
      expect(elapsedMs).toBeLessThan(SOFT_CEILING_MS)
    })
  }
})
