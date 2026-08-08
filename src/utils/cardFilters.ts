import type { Card } from '../types/card'

export interface CardFilters {
  query: string
  set: string
  type: string
  rarity: string
  color: string
}

export function filterCards(cards: Card[], filters: CardFilters): Card[] {
  const query = filters.query.trim().toLowerCase()

  return cards.filter((card) => {
    const matchesQuery =
      query.length === 0 ||
      [card.name, card.typeLine, card.oracleText, card.manaCost]
        .join(' ')
        .toLowerCase()
        .includes(query)

    const matchesSet = filters.set === 'all' || card.set === filters.set
    const matchesType =
      filters.type === 'all' ||
      card.typeLine.toLowerCase().includes(filters.type.toLowerCase())
    const matchesRarity =
      filters.rarity === 'all' || card.rarity === filters.rarity
    const matchesColor =
      filters.color === 'all' || card.colors.includes(filters.color as Card['colors'][number])

    return (
      matchesQuery &&
      matchesSet &&
      matchesType &&
      matchesRarity &&
      matchesColor
    )
  })
}

export function getUniqueSets(cards: Card[]): string[] {
  return [...new Set(cards.map((card) => card.set))].sort()
}

export function getUniqueTypes(cards: Card[]): string[] {
  return [...new Set(cards.map((card) => card.typeLine.split(' ')[0]))].sort()
}
