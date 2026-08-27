import type { Card } from '../../../../types/card'
import { Cards } from './components/Cards/Cards'
import './List.css'

interface ListProps {
  cards: Card[]
  expandedOracles: Record<string, boolean>
  onToggleOracle: (cardId: string) => void
  onOpenDetails: (card: Card, faceIndex?: number) => void
  quantities?: Record<string, number>
}

export function List({
  cards,
  expandedOracles,
  onToggleOracle,
  onOpenDetails,
  quantities,
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
          quantity={quantities?.[card.id]}
        />
      ))}
    </section>
  )
}
