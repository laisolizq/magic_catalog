import type { Card } from '../types/card'

export interface CardFilters {
  query: string
  set: string
  type: string
  rarity: string
  color: string
}

function cardSearchText(card: Card): string {
  const faceTexts = (card.faces || []).map((f) =>
    [f.name, f.typeLine, f.oracleText, f.manaCost].join(' '),
  )

  return faceTexts.join(' ').toLowerCase()
}

function cardPrimaryTypeLine(card: Card): string {
  return card.faces && card.faces[0]
    ? card.faces[0].typeLine
    : ''
}

function cardColors(card: Card): string[] {
  const colors = new Set<string>()

  ;(card.faces || []).forEach((f) => {
    ;(f.colors || []).forEach((c) => colors.add(c))
  })

  return Array.from(colors)
}

export function filterCards(cards: Card[], filters: CardFilters): Card[] {
  const query = filters.query.trim().toLowerCase()

  return cards.filter((card) => {
    const text = cardSearchText(card)

    const matchesQuery = query.length === 0 || text.includes(query)

    const matchesSet = filters.set === 'all' || card.set === filters.set

    const typeLine = cardPrimaryTypeLine(card).toLowerCase()
    const matchesType =
      filters.type === 'all' || typeLine.includes(filters.type.toLowerCase())

    const matchesRarity =
      filters.rarity === 'all' || card.rarity === filters.rarity

    const colors = cardColors(card)
    const matchesColor =
      filters.color === 'all' || colors.includes(filters.color)

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
  return [...new Set(cards.map((card) => cardPrimaryTypeLine(card).split(' ')[0]))].sort()
}
