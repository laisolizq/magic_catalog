import '../Cards/Cards.css'
import './CardSkeleton.css'

// Placeholder shaped like a card tile, shown while the catalog first loads.
export function CardSkeleton() {
  return (
    <div className="card-tile card-tile-skeleton" aria-hidden="true">
      <div className="skeleton-media" />
      <div className="skeleton-line skeleton-title" />
      <div className="skeleton-line skeleton-type" />
      <div className="skeleton-line" />
      <div className="skeleton-line skeleton-line-short" />
    </div>
  )
}
