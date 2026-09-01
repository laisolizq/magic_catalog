import type { Card, Ruling } from '../../../../types/card'
import { CardLegalities } from './CardLegalities'
import './CardModal.css'

interface RulingsModalProps {
  card: Card
  rulings: Ruling[]
  onClose: () => void
}

export function RulingsModal({ card, rulings, onClose }: RulingsModalProps) {
  return (
    <div
      className="rulings-modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchMove={(e) => {
        e.stopPropagation()
        e.preventDefault()
      }}
    >
      <div className="rulings-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="rulings-modal-header">
          <h3>Format Legality</h3>
        </div>

        <CardLegalities key={card.id} card={card} />

        <div className="rulings-modal-header">
          <h3>Rulings</h3>
        </div>

        <div className="rulings-modal-body">
          {rulings.length === 0 ? (
            <p className="rulling-empty">No rulings available.</p>
          ) : (
            rulings.map((r, idx) => (
              <div key={`${r.published_at}-${idx}`} className="rulling-item">
                <div className="rulling-date">{r.published_at}</div>
                <div className="rulling-comment">{r.comment}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default RulingsModal
