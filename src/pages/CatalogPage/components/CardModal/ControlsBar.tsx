import type { Card } from '../../../../types/card'
import scryfallIcon from '../../../../assets/icons/scryfall.svg'
import bookIcon from '../../../../assets/icons/book.svg'

interface ControlsBarProps {
  card: Card
  rulingsOpen: boolean
  onToggleRulings: () => void
  onShowPrevious: () => void
  onShowNext: () => void
  onClose: () => void
  hasPrevious: boolean
  hasNext: boolean
}

export function ControlsBar({
  card,
  rulingsOpen,
  onToggleRulings,
  onShowPrevious,
  onShowNext,
  onClose,
  hasPrevious,
  hasNext,
}: ControlsBarProps) {
  const disabledWhenRulings = rulingsOpen
  const scryfallUrl = card.collectorNumber
    ? `https://scryfall.com/card/${encodeURIComponent(card.set)}/${encodeURIComponent(card.collectorNumber)}`
    : `https://scryfall.com/search?q=oracleid%3A${encodeURIComponent(card.oracleId ?? card.id)}`

  return (
    <div className="card-modal-controls">
      <a
        className="controls-button scryfall-button"
        href={scryfallUrl}
        target="_blank"
        rel="noreferrer"
        aria-label="Open card on Scryfall"
        title="Open card on Scryfall"
      >
        <img
          className="scryfall-icon"
          src={scryfallIcon}
          alt=""
          aria-hidden="true"
        />
      </a>

      
      <button
        type="button"
        className={`controls-button ${rulingsOpen ? 'active' : ''}`}
        onClick={onToggleRulings}
        aria-pressed={rulingsOpen}
        aria-label="Toggle card details"
      >
        <img
          className="book-icon"
          src={bookIcon}
          alt=""
          aria-hidden="true"
        />
      </button>

      <button
        type="button"
        className={`controls-button ${disabledWhenRulings || !hasPrevious ? 'disabled' : ''}`}
        onClick={onShowPrevious}
        aria-label="Previous"
        disabled={disabledWhenRulings || !hasPrevious}
      >
        ▲
      </button>

      <button
        type="button"
        className={`controls-button ${rulingsOpen ? 'disabled' : ''}`}
        onClick={onClose}
        aria-label="Close"
        disabled={rulingsOpen}
      >
        ✖
      </button>

      <button
        type="button"
        className={`controls-button ${disabledWhenRulings || !hasNext ? 'disabled' : ''}`}
        onClick={onShowNext}
        aria-label="Next"
        disabled={disabledWhenRulings || !hasNext}
      >
        ▼
      </button>
    </div>
  )
}

export default ControlsBar
