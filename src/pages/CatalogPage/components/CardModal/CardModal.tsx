import { useEffect, useRef } from 'react'

import type { Card } from '../../../../types/card'
import './CardModal.css'

interface CardModalProps {
  card: Card
  onClose: () => void
  onShowPrevious: () => void
  onShowNext: () => void
  hasPrevious: boolean
  hasNext: boolean
  previousCard: Card | null
  nextCard: Card | null
}

const SWIPE_THRESHOLD = 60

export function CardModal({
  card,
  onClose,
  onShowPrevious,
  onShowNext,
  hasPrevious,
  hasNext,
  previousCard,
  nextCard,
}: CardModalProps) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const { body } = document
    const scrollY = window.scrollY

    const previous = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
    }

    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'

    return () => {
      body.style.overflow = previous.overflow
      body.style.position = previous.position
      body.style.top = previous.top
      body.style.width = previous.width

      window.scrollTo({ top: scrollY, behavior: 'instant' })
    }
  }, [])

  const handleSwipe = (deltaX: number, deltaY: number) => {
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)

    if (absX > absY) {
      if (deltaX < -SWIPE_THRESHOLD) {
        onClose()
      }
      return
    }

    if (deltaY < -SWIPE_THRESHOLD && hasNext) {
      onShowNext()
      return
    }

    if (deltaY > SWIPE_THRESHOLD && hasPrevious) {
      onShowPrevious()
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (event.key === 'ArrowUp' && hasNext) {
        onShowNext()
        return
      }

      if (event.key === 'ArrowDown' && hasPrevious) {
        onShowPrevious()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [hasNext, hasPrevious, onClose, onShowNext, onShowPrevious])

  useEffect(() => {
    const urls = [card.imageUrl, previousCard?.imageUrl, nextCard?.imageUrl]
      .filter(Boolean)

    urls.forEach((url) => {
      const img = new Image()
      img.src = url
    })
  }, [card.imageUrl, nextCard?.imageUrl, previousCard?.imageUrl])

  return (
    <div className="card-modal-overlay" role="presentation" onClick={onClose}>
      <aside
        className="card-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${card.name} details`}
        onClick={(event) => event.stopPropagation()}
        onTouchStart={(event) => {
          const touch = event.changedTouches[0]
          touchStartRef.current = { x: touch.clientX, y: touch.clientY }
        }}
        onTouchEnd={(event) => {
          const start = touchStartRef.current
          const touch = event.changedTouches[0]
          if (!start || !touch) return

          handleSwipe(touch.clientX - start.x, touch.clientY - start.y)
          touchStartRef.current = null
        }}
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
