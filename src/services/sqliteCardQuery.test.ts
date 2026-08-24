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

  it('filters by a subtype token (e.g. type:dragon)', async () => {
    const result = await queryCards({
      text: '',
      sets: [],
      types: ['Dragon'],
      rarities: [],
      colors: [],
      colorMode: 'exactly',
    })

    expect(result.cards.length).toBeGreaterThan(0)
    expect(
      result.cards.every((card) =>
        card.faces.some((face) => face.typeLine.toLowerCase().includes('dragon')),
      ),
    ).toBe(true)
  })

  it('colorMode "including" matches cards containing the selected color plus others', async () => {
    const result = await queryCards({
      text: '',
      sets: [],
      types: [],
      rarities: [],
      colors: ['U'],
      colorMode: 'including',
    })

    expect(result.cards.length).toBeGreaterThan(0)
    expect(
      result.cards.every((card) => card.faces.some((face) => face.colors.includes('U'))),
    ).toBe(true)
    // "including" must pick up multicolor cards too, unlike "exactly".
    expect(
      result.cards.some((card) => card.faces.some((face) => face.colors.length > 1)),
    ).toBe(true)
  })

  it('colorMode "atMost" matches subsets of the selected colors, including colorless cards', async () => {
    const result = await queryCards({
      text: '',
      sets: [],
      types: [],
      rarities: [],
      colors: ['U', 'W'],
      colorMode: 'atMost',
    })

    expect(result.cards.length).toBeGreaterThan(0)
    expect(
      result.cards.every((card) =>
        card.faces.some((face) => face.colors.every((color) => ['U', 'W'].includes(color))),
      ),
    ).toBe(true)
    // Colorless cards are a subset of every color set and must be included automatically.
    expect(
      result.cards.some((card) => card.faces.some((face) => face.colors.length === 0)),
    ).toBe(true)
    // Cards using a color outside the selection must be excluded.
    expect(
      result.cards.every((card) => card.faces.every((face) => !face.colors.includes('B'))),
    ).toBe(true)
  })
})
