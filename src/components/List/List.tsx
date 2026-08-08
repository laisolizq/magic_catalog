import type { Card } from '../../types/card'
import { Cards } from '../Cards/Cards'

interface ListProps {
  cards: Card[]
  expandedOracles: Record<string, boolean>
  onToggleOracle: (cardId: string) => void
  onOpenDetails: (card: Card) => void
}

export function List({
  cards,
  expandedOracles,
  onToggleOracle,
  onOpenDetails,
}: ListProps) {
  if (cards.length === 0) {
    return <p className="empty-state">No cards found for this query.</p>
  }

  return (
    <section className="cards-grid" aria-label="List">
      {cards.map((card) => (
        <Cards
          key={card.id}
          card={card}
          isOracleExpanded={Boolean(expandedOracles[card.id])}
          onToggleOracle={onToggleOracle}
          onOpenDetails={onOpenDetails}
        />
      ))}
    </section>
  )
}
