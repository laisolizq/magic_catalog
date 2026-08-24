import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { clearCatalogDatabase } from '../db/sqliteClient'
import { seedCatalogFixture } from '../test/catalogFixture'
import { queryCards, getCatalogSetOptions } from './sqliteCardQuery'

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

  it('colorMode "moreThan" matches proper supersets (like Scryfall\'s c>ug)', async () => {
    const result = await queryCards({
      text: '',
      sets: [],
      types: [],
      rarities: [],
      colors: ['U', 'G'],
      colorMode: 'moreThan',
    })

    expect(result.cards.length).toBeGreaterThan(0)
    expect(
      result.cards.every((card) =>
        card.faces.some((face) =>
          face.colors.includes('U') &&
          face.colors.includes('G') &&
          face.colors.length > 2,
        ),
      ),
    ).toBe(true)
    // Exactly UG (not a proper superset) must be excluded.
    expect(
      result.cards.every((card) =>
        !card.faces.some((face) =>
          face.colors.length === 2 &&
          face.colors.includes('U') &&
          face.colors.includes('G'),
        ),
      ),
    ).toBe(true)
  })

  it('colorMode "lessThan" matches proper subsets, including colorless cards (like Scryfall\'s c<ug)', async () => {
    const result = await queryCards({
      text: '',
      sets: [],
      types: [],
      rarities: [],
      colors: ['U', 'G'],
      colorMode: 'lessThan',
    })

    expect(result.cards.length).toBeGreaterThan(0)
    expect(
      result.cards.every((card) =>
        card.faces.some((face) =>
          face.colors.length < 2 &&
          face.colors.every((color) => ['U', 'G'].includes(color)),
        ),
      ),
    ).toBe(true)
    // Colorless cards are a proper subset of every non-empty color set.
    expect(
      result.cards.some((card) => card.faces.some((face) => face.colors.length === 0)),
    ).toBe(true)
    // Exactly UG must be excluded.
    expect(
      result.cards.every((card) =>
        !card.faces.some((face) =>
          face.colors.length === 2 &&
          face.colors.includes('U') &&
          face.colors.includes('G'),
        ),
      ),
    ).toBe(true)
  })

  it('colorMode "not" matches cards whose colors aren\'t exactly the selection', async () => {
    const result = await queryCards({
      text: '',
      sets: [],
      types: [],
      rarities: [],
      colors: ['U', 'G'],
      colorMode: 'not',
    })

    const isExactlyUG = (colors: string[]) =>
      colors.length === 2 && colors.includes('U') && colors.includes('G')

    expect(result.cards.length).toBeGreaterThan(0)
    expect(
      result.cards.every((card) =>
        card.faces.some((face) => !isExactlyUG(face.colors)),
      ),
    ).toBe(true)
  })

  it('colorCount ">=" matches cards with at least that many colors', async () => {
    const result = await queryCards({
      text: '',
      sets: [],
      types: [],
      rarities: [],
      colors: [],
      colorMode: 'exactly',
      colorCount: { operator: '>=', value: 2 },
    })

    expect(result.cards.length).toBeGreaterThan(0)
    expect(
      result.cards.every((card) =>
        card.faces.some((face) => face.colors.length >= 2),
      ),
    ).toBe(true)
  })

  it('colorCount "=" with 0 matches colorless cards', async () => {
    const result = await queryCards({
      text: '',
      sets: [],
      types: [],
      rarities: [],
      colors: [],
      colorMode: 'exactly',
      colorCount: { operator: '=', value: 0 },
    })

    expect(result.cards.length).toBeGreaterThan(0)
    expect(
      result.cards.every((card) =>
        card.faces.some((face) => face.colors.length === 0),
      ),
    ).toBe(true)
  })

  it('colorCount "!=" includes colorless cards as a non-match for any positive count', async () => {
    const result = await queryCards({
      text: '',
      sets: [],
      types: [],
      rarities: [],
      colors: [],
      colorMode: 'exactly',
      colorCount: { operator: '!=', value: 1 },
    })

    // Colorless (0 colors) and multicolor (2+ colors) faces both satisfy "!= 1".
    expect(
      result.cards.every((card) =>
        card.faces.some((face) => face.colors.length !== 1),
      ),
    ).toBe(true)
  })

  it('colorCount "<" includes colorless cards, since 0 is less than any positive count', async () => {
    const result = await queryCards({
      text: '',
      sets: [],
      types: [],
      rarities: [],
      colors: [],
      colorMode: 'exactly',
      colorCount: { operator: '<', value: 2 },
    })

    expect(result.cards.length).toBeGreaterThan(0)
    expect(
      result.cards.every((card) =>
        card.faces.some((face) => face.colors.length < 2),
      ),
    ).toBe(true)
  })
})

describe('getCatalogSetOptions', () => {
  it('returns known sets with names and types, sorted by release date descending', async () => {
    const options = await getCatalogSetOptions()

    expect(options.length).toBeGreaterThan(0)
    expect(options.map((option) => option.code)).toContain('hob')

    const hob = options.find((option) => option.code === 'hob')
    expect(hob?.name).toBe('The Hobbit')
    expect(hob?.setType).toBe('expansion')

    const releaseDates = options.map((option) => option.releasedAt)
    const sortedDescending = [...releaseDates].sort().reverse()
    expect(releaseDates).toEqual(sortedDescending)
  })
})
