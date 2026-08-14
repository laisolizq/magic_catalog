import type { Ruling } from '../../../../types/card'
import './CardModal.css'

interface RulingsModalProps {
  rulings: Ruling[]
  onClose: () => void
}

export function RulingsModal({ rulings, onClose }: RulingsModalProps) {
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
          <h3>Rulings</h3>
        </div>

        <div className="rulings-modal-body">
          {rulings.map((r, idx) => (
            <div key={`${r.published_at}-${idx}`} className="rulling-item">
              <div className="rulling-date">{r.published_at}</div>
              <div className="rulling-comment">{r.comment}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default RulingsModal
