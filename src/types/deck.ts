export interface DeckCardEntry {
  cardId: string
  quantity: number
  rawName: string
}

export interface UnresolvedDeckLine {
  rawLine: string
  reason: string
}

export interface Deck {
  id: string
  name: string
  createdAt: string
  cards: DeckCardEntry[]
  unresolvedLines: UnresolvedDeckLine[]
}
