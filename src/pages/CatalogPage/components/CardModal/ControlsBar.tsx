// ControlsBar: modal controls (rulings, prev, close, next)

interface ControlsBarProps {
  hasRulings: boolean
  rulingsOpen: boolean
  onToggleRulings: () => void
  onShowPrevious: () => void
  onShowNext: () => void
  onClose: () => void
  hasPrevious: boolean
  hasNext: boolean
}

export function ControlsBar({
  hasRulings,
  rulingsOpen,
  onToggleRulings,
  onShowPrevious,
  onShowNext,
  onClose,
  hasPrevious,
  hasNext,
}: ControlsBarProps) {
  const disabledWhenRulings = rulingsOpen

  return (
    <div className="card-modal-controls">
      <button
        type="button"
        className={`controls-button ${!hasRulings ? 'disabled' : ''} ${rulingsOpen ? 'active' : ''}`}
        onClick={onToggleRulings}
        aria-pressed={rulingsOpen}
        aria-label="Toggle rulings"
        disabled={!hasRulings && !rulingsOpen}
      >
        📖
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
