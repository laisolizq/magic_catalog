import { useEffect } from 'react'

import type { Card } from '../../../../types/card'
import './CardModal.css'

interface CardModalProps {
  card: Card
  onClose: () => void
}

export function CardModal({ card, onClose }: CardModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="card-modal-overlay" role="presentation" onClick={onClose}>
      <aside
        className="card-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${card.name} details`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="card-modal-image-wrap">
          <img className="card-modal-image" src={card.imageUrl} alt={card.name} />
        </div>
        <div className="card-modal-actions">
          <button type="button" onClick={onClose}>
            X
          </button>
        </div>
      </aside>
    </div>
  )
}
