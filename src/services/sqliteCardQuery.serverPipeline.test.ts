import { afterEach, describe, expect, it } from 'vitest'

import type { Card } from '../types/card'
import { clearCatalogDatabase } from '../db/sqliteClient'
import { seedCards } from '../test/catalogFixture'
import { selectLatestPrintings } from '../pages/CatalogPage/selectLatestPrintings'
import { sortCards, type SortOption } from '../pages/CatalogPage/CatalogPage'
import { queryCards } from './sqliteCardQuery'

afterEach(() => clearCatalogDatabase())

function makeCard(overrides: Partial<Card> & { id: string; faceName: string }): Card {
  return {
    set: 'xxx',
    rarity: 'common',
    faces: [{
      name: overrides.faceName,
      manaCost: '{1}',
      typeLine: 'Creature — Test',
      oracleText: '',
      colors: [],
      imageUrl: '',
    }],
    ...overrides,
  }
}

describe('queryCards server-side dedup (showAllPrints: false)', () => {
  it('deduplicates within a filtered query instead of requiring the global preferred printing', async () => {
    const cards: Card[] = [
      makeCard({
        id: 'tsr-printing',
        faceName: 'Shared Card',
        set: 'tsr',
        setType: 'expansion',
        releasedAt: '2023-01-01',
      }),
      makeCard({
        id: 'other-printing',
        faceName: 'Shared Card',
        set: 'other',
        setType: 'expansion',
        releasedAt: '2024-01-01',
      }),
    ]

    await seedCards(cards)

    const result = await queryCards({
      text: '',
      sets: ['tsr'],
      types: [],
      rarities: [],
      colors: [],
      colorMode: 'exactly',
      showAllPrints: false,
    })

    expect(result.cards.map((card) => card.id)).toEqual(['tsr-printing'])
    expect(result.total).toBe(1)
  })

  it('matches selectLatestPrintings for the same tier/promo/collector-number scenarios', async () => {
    const cards: Card[] = [
      // Scenario 1: newest core/expansion printing beats an even-newer non-major reprint.
      makeCard({ id: 'expansion-old', faceName: 'Alpha', set: 'old', setType: 'expansion', releasedAt: '2020-01-01' }),
      makeCard({ id: 'expansion-new', faceName: 'Alpha', set: 'new', setType: 'expansion', releasedAt: '2023-01-01' }),
      makeCard({ id: 'masters-newest', faceName: 'Alpha', set: 'mst', setType: 'masters', releasedAt: '2024-01-01' }),

      // Scenario 2: within a single non-core/expansion tier, the oldest printing wins.
      makeCard({ id: 'h2r-mh2', faceName: 'Bravo', set: 'mh2', setType: 'draft_innovation', releasedAt: '2021-06-18' }),
      makeCard({ id: 'h2r-timeshift', faceName: 'Bravo', set: 'h2r', setType: 'draft_innovation', releasedAt: '2024-06-14' }),

      // Scenario 3: same, across three non-core/expansion sets.
      makeCard({ id: 'nec', faceName: 'Charlie', set: 'nec', setType: 'commander', releasedAt: '2022-02-18' }),
      makeCard({ id: 'mh3', faceName: 'Charlie', set: 'mh3', setType: 'draft_innovation', releasedAt: '2024-06-14' }),
      makeCard({ id: 'mkc', faceName: 'Charlie', set: 'mkc', setType: 'commander', releasedAt: '2024-02-09' }),

      // Scenario 4: same-set reprint reusing a later releasedAt - collector number decides, not release date.
      makeCard({ id: 'ltr-original', faceName: 'Delta', set: 'ltr', setType: 'draft_innovation', collectorNumber: '10', releasedAt: '2023-06-23' }),
      makeCard({ id: 'ltr-holiday', faceName: 'Delta', set: 'ltr', setType: 'draft_innovation', collectorNumber: '461', releasedAt: '2023-11-03' }),

      // Scenario 5: promo printing predates its parent set - non-promo still wins.
      makeCard({ id: 'promo-early', faceName: 'Echo', set: 'pmh2', setType: 'promo', releasedAt: '2021-05-01' }),
      makeCard({ id: 'parent-set', faceName: 'Echo', set: 'mh2', setType: 'draft_innovation', releasedAt: '2021-06-18' }),
    ]

    await seedCards(cards)

    const expectedIds = new Set(selectLatestPrintings(cards).map((card) => card.id))

    const result = await queryCards({
      text: '',
      sets: [],
      types: [],
      rarities: [],
      colors: [],
      colorMode: 'exactly',
      showAllPrints: false,
    })

    expect(result.serverPaginated).toBe(true)
    expect(new Set(result.cards.map((card) => card.id))).toEqual(expectedIds)
    expect(result.cards.length).toBe(expectedIds.size)
  })
})

describe('queryCards server-side sort (matches CatalogPage sortCards)', () => {
  const cards: Card[] = [
    makeCard({ id: 'a', faceName: 'Zephyr Wolf', set: 'aaa', collectorNumber: '3', releasedAt: '2022-01-01', addedAt: '2024-05-01' }),
    { ...makeCard({ id: 'b', faceName: 'Ember Fox', set: 'bbb', collectorNumber: '1', releasedAt: '2023-01-01', addedAt: '2024-06-01' }), faces: [{ name: 'Ember Fox', manaCost: '{3}{R}', typeLine: 'Creature — Fox', oracleText: '', colors: ['R'], imageUrl: '' }] },
    { ...makeCard({ id: 'c', faceName: 'Ancient Owl', set: 'aaa', collectorNumber: '1', releasedAt: '2022-01-01', addedAt: '2024-04-01' }), faces: [{ name: 'Ancient Owl', manaCost: '{X}', typeLine: 'Creature — Owl', oracleText: '', colors: [], imageUrl: '' }] },
  ]

  const options: SortOption[] = ['set-asc', 'set-desc', 'name-asc', 'name-desc', 'cmc-asc', 'cmc-desc', 'added-asc', 'added-desc']

  it.each(options)('orders by %s the same as the JS sortCards comparator', async (sortOption) => {
    await seedCards(cards)

    const result = await queryCards({
      text: '',
      sets: [],
      types: [],
      rarities: [],
      colors: [],
      colorMode: 'exactly',
      showAllPrints: true,
      sortOption,
    })

    const expectedOrder = sortCards(cards, sortOption).map((card) => card.id)
    expect(result.serverPaginated).toBe(true)
    expect(result.cards.map((card) => card.id)).toEqual(expectedOrder)
  })
})

describe('queryCards legality filtering', () => {
  const cards: Card[] = [
    makeCard({ id: 'modern-legal', faceName: 'Modern Legal', legalities: { modern: 'legal' } }),
    makeCard({ id: 'modern-banned', faceName: 'Modern Banned', legalities: { modern: 'banned' } }),
    makeCard({ id: 'modern-restricted', faceName: 'Modern Restricted', legalities: { modern: 'restricted' } }),
    makeCard({ id: 'modern-not-legal', faceName: 'Modern Not Legal', legalities: { modern: 'not_legal' } }),
  ]

  it.each([
    ['legal', 'modern-legal'],
    ['banned', 'modern-banned'],
    ['restricted', 'modern-restricted'],
    ['not_legal', 'modern-not-legal'],
  ] as const)('returns only %s cards', async (status, expectedId) => {
    await seedCards(cards)

    const result = await queryCards({
      text: '',
      sets: [],
      types: [],
      rarities: [],
      colors: [],
      colorMode: 'exactly',
      legality: { format: 'modern', status },
      showAllPrints: true,
      sortOption: 'name-asc',
    })

    expect(result.cards.map((card) => card.id)).toEqual([expectedId])
  })

  it('keeps banned and not-legal distinct in the legacy text-search path', async () => {
    const textCards = cards.map((card) => ({
      ...card,
      faces: [{ ...card.faces[0], name: `Modern ${card.faces[0].name}` }],
    }))
    await seedCards(textCards)

    const result = await queryCards({
      text: 'Modern',
      sets: [],
      types: [],
      rarities: [],
      colors: [],
      colorMode: 'exactly',
      legality: { format: 'modern', status: 'banned' },
    })

    expect(result.cards.map((card) => card.id)).toEqual(['modern-banned'])
  })
})

describe('queryCards server-side pagination', () => {
  it('slices results with limit/offset while reporting the untruncated total', async () => {
    const cards: Card[] = Array.from({ length: 5 }, (_, index) =>
      makeCard({ id: `card-${index}`, faceName: `Name ${index}`, set: 'aaa', collectorNumber: String(index) }),
    )
    await seedCards(cards)

    const firstPage = await queryCards({
      text: '',
      sets: [],
      types: [],
      rarities: [],
      colors: [],
      colorMode: 'exactly',
      showAllPrints: true,
      sortOption: 'name-asc',
      limit: 2,
      offset: 0,
    })
    const secondPage = await queryCards({
      text: '',
      sets: [],
      types: [],
      rarities: [],
      colors: [],
      colorMode: 'exactly',
      showAllPrints: true,
      sortOption: 'name-asc',
      limit: 2,
      offset: 2,
    })

    expect(firstPage.total).toBe(5)
    expect(secondPage.total).toBe(5)
    expect(firstPage.cards.map((card) => card.id)).toEqual(['card-0', 'card-1'])
    expect(secondPage.cards.map((card) => card.id)).toEqual(['card-2', 'card-3'])
  })
})
