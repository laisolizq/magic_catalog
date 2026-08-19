import { useEffect, useRef, useState } from 'react'

import type { Card } from '../../../../types/card'
import './CardModal.css'
import { ControlsBar } from './ControlsBar'
import { RulingsModal } from './RulingsModal'

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

// Some double-faced cards are missing dedicated back-face art, so the second
// face's image falls back to the same one as the first face. Treat that as
// "not a real face" so navigation skips straight past it.
function isDuplicateFaceImage(card: Card, faceIndex: number): boolean {
  const faces = card.faces || []
  if (faceIndex <= 0 || faceIndex >= faces.length) return false

  const image = faces[faceIndex].imageUrl
  return Boolean(image) && image === faces[0].imageUrl
}

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

  const goToNextFace = () => {
    if (rulingsOpen) return
    const faces = card.faces || []

    let nextIndex = currentFaceIndex + 1
    while (nextIndex < faces.length && isDuplicateFaceImage(card, nextIndex)) {
      nextIndex++
    }

    if (nextIndex < faces.length) {
      setCurrentFaceIndex(nextIndex)
    } else if (hasNext) {
      onShowNext()
    }
  }

  const goToPreviousFace = () => {
    if (rulingsOpen) return

    let prevIndex = currentFaceIndex - 1
    while (prevIndex > 0 && isDuplicateFaceImage(card, prevIndex)) {
      prevIndex--
    }

    if (prevIndex >= 0) {
      setCurrentFaceIndex(prevIndex)
    } else if (hasPrevious) {
      onShowPrevious()
    }
  }

  const handleSwipe = (deltaX: number, deltaY: number) => {
    if (rulingsOpen) return
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
        goToNextFace()
        return
      }

      if (deltaY > SWIPE_THRESHOLD) {
        // swipe down -> previous face
        goToPreviousFace()
      }
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (rulingsOpen) {
          setRulingsOpen(false)
          return
        }

        onClose()
        return
      }

      if (event.key === 'ArrowLeft') {
        onClose()
        return
      }

      if (rulingsOpen) return

      if (event.key === 'ArrowUp') {
        // previous face
        goToPreviousFace()
        return
      }

      if (event.key === 'ArrowDown') {
        // next face
        goToNextFace()
        return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [currentFaceIndex, hasNext, hasPrevious, onClose, onShowNext, onShowPrevious, card])

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
  const [rulingsOpen, setRulingsOpen] = useState(false)

  const hasRulings = (card.rulings ?? []).length > 0

  const toggleRulings = () => {
    setRulingsOpen((v) => !v)
  }

  const handlePrev = goToPreviousFace
  const handleNext = goToNextFace

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

        <ControlsBar
          hasRulings={hasRulings}
          rulingsOpen={rulingsOpen}
          onToggleRulings={toggleRulings}
          onShowPrevious={handlePrev}
          onShowNext={handleNext}
          onClose={() => {
            if (rulingsOpen) return
            onClose()
          }}
          hasPrevious={hasPrevious}
          hasNext={hasNext}
        />

        {rulingsOpen && hasRulings && (
          <RulingsModal
            rulings={card.rulings ?? []}
            onClose={toggleRulings}
          />
        )}
      </aside>
    </div>
  )
}
