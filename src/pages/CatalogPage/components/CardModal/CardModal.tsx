import { useEffect, useRef, useState } from 'react'

import type { Card } from '../../../../types/card'
import './CardModal.css'

interface CardModalProps {
  card: Card
  initialFaceIndex?: number
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
  initialFaceIndex = 0,
  onClose,
  onShowPrevious,
  onShowNext,
  hasPrevious,
  hasNext,
  previousCard,
  nextCard,
}: CardModalProps) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const [currentFaceIndex, setCurrentFaceIndex] = useState<number>(
    Math.max(0, Math.min(initialFaceIndex, (card.faces || []).length - 1)),
  )

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

    // Horizontal swipes: close modal
    if (absX > absY && absX > SWIPE_THRESHOLD) {
      if (deltaX < -SWIPE_THRESHOLD) {
        onClose()
      }
      return
    }

    // Vertical swipes: navigate faces; if at boundary, navigate cards
    if (absY > absX && absY > SWIPE_THRESHOLD) {
      if (deltaY < -SWIPE_THRESHOLD) {
        // swipe up -> next face
        if ((card.faces || []).length - 1 > currentFaceIndex) {
          setCurrentFaceIndex((i) => i + 1)
        } else if (hasNext) {
          onShowNext()
        }
        return
      }

      if (deltaY > SWIPE_THRESHOLD) {
        // swipe down -> previous face
        if (currentFaceIndex > 0) {
          setCurrentFaceIndex((i) => i - 1)
        } else if (hasPrevious) {
          onShowPrevious()
        }
      }
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (event.key === 'ArrowLeft') {
        onClose()
        return
      }

      if (event.key === 'ArrowUp') {
        // previous face
        if (currentFaceIndex > 0) {
          setCurrentFaceIndex((i) => i - 1)
        } else if (hasPrevious) {
          onShowPrevious()
        }
        return
      }

      if (event.key === 'ArrowDown') {
        // next face
        if (currentFaceIndex < (card.faces || []).length - 1) {
          setCurrentFaceIndex((i) => i + 1)
        } else if (hasNext) {
          onShowNext()
        }
        return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [currentFaceIndex, hasNext, hasPrevious, onClose, onShowNext, onShowPrevious, card.faces])

  useEffect(() => {
    // preload current card faces and neighbor cards' primary faces
    const faces = card.faces || []
    const urls: string[] = []
    faces.forEach((f) => f.imageUrl && urls.push(f.imageUrl))
    const prev = previousCard?.faces?.[0]
    const next = nextCard?.faces?.[0]
    if (prev?.imageUrl) urls.push(prev.imageUrl)
    if (next?.imageUrl) urls.push(next.imageUrl)

    urls.forEach((url) => {
      const img = new Image()
      img.src = url
    })
  }, [card, previousCard, nextCard])

  useEffect(() => {
    // Sync when initialFaceIndex changes (opening a different face)
    setCurrentFaceIndex(
      Math.max(0, Math.min(initialFaceIndex, (card.faces || []).length - 1)),
    )
  }, [initialFaceIndex, card.faces])

  const face = card.faces?.[currentFaceIndex]

  return (
    <div className="card-modal-overlay" role="presentation" onClick={onClose}>
      <aside
        className="card-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${face?.name ?? ''} details`}
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
          <img className="card-modal-image" src={face?.imageUrl} alt={face?.name} />
        </div>
        <div className="card-modal-actions">
          <button type="button" onClick={onClose} aria-label="Close">
            X
          </button>
        </div>
      </aside>
    </div>
  )
}
