import type { Card } from '../../types/card'

export function mergeUniqueCards(
  currentCards: Card[],
  incomingCards: Card[],
): Card[] {
  const cardsById = new Map(currentCards.map((card) => [card.id, card]))

  incomingCards.forEach((card) => cardsById.set(card.id, card))

  return Array.from(cardsById.values())
}