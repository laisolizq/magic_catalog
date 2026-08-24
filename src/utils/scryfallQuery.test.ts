import { describe, expect, it } from 'vitest'

import { buildScryfallQuery, parseScryfallQuery } from './scryfallQuery'

describe('parseScryfallQuery', () => {
  it('returns empty filters for an empty string', () => {
    expect(parseScryfallQuery('')).toEqual({
      text: '',
      colors: [],
      colorMode: 'exactly',
      colorCount: null,
      types: [],
      rarities: [],
      sets: [],
    })
  })

  it('parses plain free text with no operators', () => {
    expect(parseScryfallQuery('dragon whelp')).toEqual({
      text: 'dragon whelp',
      colors: [],
      colorMode: 'exactly',
      colorCount: null,
      types: [],
      rarities: [],
      sets: [],
    })
  })

  it('parses single and multiple color letters', () => {
    expect(parseScryfallQuery('c=w').colors).toEqual(['W'])
    expect(parseScryfallQuery('c=wu').colors).toEqual(['W', 'U'])
  })

  it('parses colorless and multicolor operators', () => {
    expect(parseScryfallQuery('c=colorless').colors).toEqual(['C'])
    expect(parseScryfallQuery('c=c').colors).toEqual(['C'])
    expect(parseScryfallQuery('c>1').colors).toEqual(['M'])
    expect(parseScryfallQuery('color>1').colors).toEqual(['M'])
  })

  it('parses colorless/multicolor words directly', () => {
    expect(parseScryfallQuery('c=multicolor').colors).toEqual(['M'])
    expect(parseScryfallQuery('c=m').colors).toEqual(['M'])
  })

  it('parses comparison operators against a range of colors', () => {
    expect(parseScryfallQuery('c>ug')).toMatchObject({
      colors: ['U', 'G'],
      colorMode: 'moreThan',
    })
    expect(parseScryfallQuery('c<ug')).toMatchObject({
      colors: ['U', 'G'],
      colorMode: 'lessThan',
    })
    expect(parseScryfallQuery('c!=ug')).toMatchObject({
      colors: ['U', 'G'],
      colorMode: 'not',
    })
  })

  it('builds and round-trips comparison operators against a range of colors', () => {
    for (const colorMode of ['moreThan', 'lessThan', 'not'] as const) {
      const built = buildScryfallQuery({
        text: '',
        colors: ['U', 'G'],
        colorMode,
        types: [],
        rarities: [],
        sets: [],
      })
      expect(parseScryfallQuery(built).colorMode).toBe(colorMode)
      expect(parseScryfallQuery(built).colors).toEqual(['U', 'G'])
    }
  })

  it('parses color count comparisons', () => {
    expect(parseScryfallQuery('c>=2').colorCount).toEqual({
      operator: '>=',
      value: 2,
    })
    expect(parseScryfallQuery('c<3').colorCount).toEqual({
      operator: '<',
      value: 3,
    })
    expect(parseScryfallQuery('c!=1').colorCount).toEqual({
      operator: '!=',
      value: 1,
    })
    expect(parseScryfallQuery('c=0').colorCount).toEqual({
      operator: '=',
      value: 0,
    })
  })

  it('still treats c>1 as the Multicolor chip rather than a color count', () => {
    const parsed = parseScryfallQuery('c>1')
    expect(parsed.colors).toEqual(['M'])
    expect(parsed.colorCount).toBeNull()
  })

  it('accumulates multiple t: clauses into an array', () => {
    expect(parseScryfallQuery('t:creature t:instant').types).toEqual([
      'Creature',
      'Instant',
    ])
  })

  it('parses r: and s: tokens', () => {
    const parsed = parseScryfallQuery('r:rare s:tla')
    expect(parsed.rarities).toEqual(['rare'])
    expect(parsed.sets).toEqual(['tla'])
  })

  it('parses rarity abbreviations into full words', () => {
    expect(parseScryfallQuery('r:c').rarities).toEqual(['common'])
    expect(parseScryfallQuery('r:u').rarities).toEqual(['uncommon'])
    expect(parseScryfallQuery('r:r').rarities).toEqual(['rare'])
    expect(parseScryfallQuery('r:m').rarities).toEqual(['mythic'])
  })

  it('keeps quoted free text phrases together and mixes with operators', () => {
    const parsed = parseScryfallQuery('"draw a card" t:instant')
    expect(parsed.text).toBe('draw a card')
    expect(parsed.types).toEqual(['Instant'])
  })

  it('parses mixed free text and multiple filter categories', () => {
    const parsed = parseScryfallQuery('dragon c=wu t:creature r:rare s:tla')

    expect(parsed).toEqual({
      text: 'dragon',
      colors: ['W', 'U'],
      colorMode: 'exactly',
      colorCount: null,
      types: ['Creature'],
      rarities: ['rare'],
      sets: ['tla'],
    })
  })
})

describe('buildScryfallQuery', () => {
  it('round-trips filters through parseScryfallQuery', () => {
    const filters = {
      text: 'dragon',
      colors: ['W', 'U', 'C'],
      colorMode: 'exactly' as const,
      colorCount: null,
      types: ['Creature', 'Instant'],
      rarities: ['rare', 'mythic'],
      sets: ['tla', 'hob'],
    }

    const built = buildScryfallQuery(filters)
    const reparsed = parseScryfallQuery(built)

    expect(reparsed).toEqual(filters)
  })

  it('builds c>1 for multicolor', () => {
    expect(buildScryfallQuery({
      text: '',
      colors: ['M'],
      types: [],
      rarities: [],
      sets: [],
    })).toBe('c>1')
  })

  it('builds and round-trips color count comparisons', () => {
    const built = buildScryfallQuery({
      text: '',
      colors: [],
      types: [],
      rarities: [],
      sets: [],
      colorCount: { operator: '>=', value: 2 },
    })

    expect(built).toBe('c>=2')
    expect(parseScryfallQuery(built).colorCount).toEqual({
      operator: '>=',
      value: 2,
    })
  })

  it('builds rarities using Scryfall abbreviations', () => {
    expect(buildScryfallQuery({
      text: '',
      colors: [],
      types: [],
      rarities: ['uncommon'],
      sets: [],
    })).toBe('r:u')
  })
})
