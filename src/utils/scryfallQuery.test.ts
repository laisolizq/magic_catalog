import { describe, expect, it } from 'vitest'

import { buildScryfallQuery, parseScryfallQuery } from './scryfallQuery'

describe('parseScryfallQuery', () => {
  it('returns empty filters for an empty string', () => {
    expect(parseScryfallQuery('')).toEqual({
      text: '',
      colors: [],
      types: [],
      rarities: [],
      sets: [],
    })
  })

  it('parses plain free text with no operators', () => {
    expect(parseScryfallQuery('dragon whelp')).toEqual({
      text: 'dragon whelp',
      colors: [],
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
})
