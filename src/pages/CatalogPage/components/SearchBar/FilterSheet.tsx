import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

import './FilterSheet.css'

export interface FilterSheetOption {
  value: string
  label: ReactNode
  className?: string
}

interface FilterSheetProps {
  title: string
  options: FilterSheetOption[]
  selectedValues: string[]
  onSelect: (value: string) => void
  onClose: () => void
}

export function FilterSheet({
  title,
  options,
  selectedValues,
  onSelect,
  onClose,
}: FilterSheetProps) {
  // Rendered in a portal so the fixed overlay isn't clipped/repositioned by
  // the search bar wrapper's translateY transform (which creates its own
  // containing block for fixed-position descendants).
  return createPortal(
    <div className="filter-sheet-overlay" onClick={onClose}>
      <div
        className="filter-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        // Clicks inside the sheet must not bubble to the overlay's onClose.
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="filter-sheet-title">{title}</h2>

        <div className="filter-sheet-options">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={selectedValues.includes(option.value)}
              className={`filter-sheet-option ${option.className ?? ''} ${
                selectedValues.includes(option.value) ? 'is-selected' : ''
              }`}
              onClick={() => onSelect(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
