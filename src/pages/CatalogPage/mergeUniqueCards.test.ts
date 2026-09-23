import { describe, expect, it } from 'vitest'

import type { Card } from '../../types/card'
import { mergeUniqueCards } from './mergeUniqueCards'

function card(id: string, set: string): Card {
  return {
    id,
    set,
    rarity: 'common',
    faces: [{
      name: id,
      manaCost: '',
      typeLine: 'Artifact',
      oracleText: '',
      colors: [],
      imageUrl: '',
    }],
  }
}

describe('mergeUniqueCards', () => {
  it('preserves order and keeps only the latest card for each ID', () => {
    const first = card('first', 'old')
    const updatedFirst = card('first', 'new')
    const second = card('second', 'new')

    expect(mergeUniqueCards(
      [first],
      [updatedFirst, second, second],
    )).toEqual([updatedFirst, second])
  })
})