import { deleteDeck, getDeck, listDecks, saveDeck } from '../db/sqliteClient'
import { parseDecklistLines, resolveDecklistLines } from './decklistParser'
import type { Deck } from '../types/deck'

export { listDecks, getDeck, deleteDeck }

export async function createDeck(name: string, pastedText: string): Promise<Deck> {
  const parsedLines = parseDecklistLines(pastedText)
  const { cards, unresolvedLines } = await resolveDecklistLines(parsedLines)

  const deck: Deck = {
    id: crypto.randomUUID(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
    cards,
    unresolvedLines,
  }

  await saveDeck(deck)
  return deck
}
