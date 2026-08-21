import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { clearCatalogDatabase } from '../db/sqliteClient'
import { seedCatalogFixture } from '../test/catalogFixture'
import { queryCards } from './sqliteCardQuery'

beforeEach(() => seedCatalogFixture())
afterEach(() => clearCatalogDatabase())

describe('queryCards with SQLite', () => {
  it('uses the set index and returns matching cards', async () => {
    const result = await queryCards({
      text: '',
      sets: ['hob'],
      types: [],
      rarities: [],
      colors: [],
      colorMode: 'exactly',
    })

    expect(result.cards.length).toBeGreaterThan(0)
    expect(result.cards.every((card) => card.set === 'hob')).toBe(true)
  })

  it('filters by a type token and face color', async () => {
    const result = await queryCards({
      text: '',
      sets: [],
      types: ['Creature'],
      rarities: [],
      colors: ['U'],
      colorMode: 'exactly',
    })

    expect(result.cards.every((card) =>
      card.faces.some((face) => face.typeLine.toLowerCase().includes('creature')) &&
      card.faces.some((face) => face.colors.includes('U')),
    )).toBe(true)
  })
})
