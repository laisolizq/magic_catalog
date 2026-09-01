import type { Card } from '../../../../types/card'
import { Cards } from './components/Cards/Cards'
import './List.css'

interface CardDateGroup {
  date: string | null
  cards: Card[]
}

function formatAddedDate(date: string | null): string {
  if (!date) return 'Unknown date'

  const [year, month, day] = date.split('-').map(Number)
  const calendarDate = new Date(year, month - 1, day)
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const dayDifference = Math.round(
    (todayStart.getTime() - calendarDate.getTime()) / (24 * 60 * 60 * 1000),
  )

  if (dayDifference === 0) return 'Today'
  if (dayDifference === 1) return 'Yesterday'

  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(calendarDate)
}

function groupCardsByAddedDate(cards: Card[]): CardDateGroup[] {
  const groups = new Map<string | null, Card[]>()

  for (const card of cards) {
    const date = card.addedAt || null
    const cardsForDate = groups.get(date)
    if (cardsForDate) {
      cardsForDate.push(card)
    } else {
      groups.set(date, [card])
    }
  }

  return Array.from(groups, ([date, groupedCards]) => ({
    date,
    cards: groupedCards,
  }))
}

interface ListProps {
  cards: Card[]
  showAddedDateGroups?: boolean
  expandedOracles: Record<string, boolean>
  onToggleOracle: (cardId: string) => void
  onOpenDetails: (card: Card, faceIndex?: number) => void
  quantities?: Record<string, number>
}

export function List({
  cards,
  showAddedDateGroups = false,
  expandedOracles,
  onToggleOracle,
  onOpenDetails,
  quantities,
}: ListProps) {
  if (cards.length === 0) {
    return <p className="empty-state">No cards found for this query.</p>
  }

  const renderCard = (card: Card) => (
    <Cards
      key={card.id}
      card={card}
      isOracleExpanded={Boolean(expandedOracles[card.id])}
      onToggleOracle={onToggleOracle}
      onOpenDetails={onOpenDetails}
      quantity={quantities?.[card.id]}
    />
  )

  if (showAddedDateGroups) {
    return (
      <section className="cards-list" aria-label="List">
        {groupCardsByAddedDate(cards).map((group) => (
          <section className="cards-date-group" key={group.date ?? 'unknown'}>
            <h2 className="cards-date-header">{formatAddedDate(group.date)}</h2>
            <div className="cards-grid">
              {group.cards.map(renderCard)}
            </div>
          </section>
        ))}
      </section>
    )
  }

  return (
    <section className="cards-grid" aria-label="List">
      {cards.map(renderCard)}
    </section>
  )
}
