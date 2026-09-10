import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Card } from '../../../../types/card'
import { CardModal } from './CardModal'

const card: Card = {
  id: 'test-card',
  set: 'tst',
  rarity: 'common',
  faces: [
    {
      name: 'Test Card',
      manaCost: '',
      typeLine: 'Artifact',
      oracleText: '',
      colors: [],
      imageUrl: 'https://example.test/card.jpg',
    },
  ],
}

const doubleFacedCard: Card = {
  ...card,
  faces: [
    card.faces[0],
    {
      ...card.faces[0],
      name: 'Test Card Back',
      imageUrl: 'https://example.test/card-back.jpg',
    },
  ],
}

function renderModal(overrides: Partial<React.ComponentProps<typeof CardModal>> = {}) {
  const props: React.ComponentProps<typeof CardModal> = {
    card,
    onClose: vi.fn(),
    onShowPrevious: vi.fn(),
    onShowNext: vi.fn(),
    hasPrevious: false,
    hasNext: false,
    previousCard: null,
    nextCard: null,
    ...overrides,
  }

  return {
    ...render(<CardModal {...props} />),
    props,
  }
}

function swipe(
  dialog: HTMLElement,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  fireEvent.touchStart(dialog, {
    changedTouches: [{ clientX: from.x, clientY: from.y }],
  })
  fireEvent.touchEnd(dialog, {
    changedTouches: [{ clientX: to.x, clientY: to.y }],
  })
}

describe('CardModal', () => {
  it('shows a placeholder until the active card image loads', () => {
    const { container } = render(
      <CardModal
        card={card}
        onClose={vi.fn()}
        onShowPrevious={vi.fn()}
        onShowNext={vi.fn()}
        hasPrevious={false}
        hasNext={false}
        previousCard={null}
        nextCard={null}
      />,
    )

    const image = screen.getByRole('img', { name: 'Test Card' })
    expect(container.querySelector('.card-modal-image-placeholder')).toBeInTheDocument()
    expect(image).not.toHaveClass('is-loaded')

    fireEvent.load(image)

    expect(container.querySelector('.card-modal-image-placeholder')).not.toBeInTheDocument()
    expect(image).toHaveClass('is-loaded')
  })

  it('swipes up to the next face and down to the previous face', () => {
    const { container } = renderModal({ card: doubleFacedCard })
    const { getByRole } = within(container)
    const dialog = getByRole('dialog')

    swipe(dialog, { x: 100, y: 180 }, { x: 100, y: 80 })
    expect(getByRole('img', { name: 'Test Card Back' })).toBeInTheDocument()

    swipe(dialog, { x: 100, y: 80 }, { x: 100, y: 180 })
    expect(getByRole('img', { name: 'Test Card' })).toBeInTheDocument()
  })

  it('swipes up to the next card and down to the previous card at face boundaries', () => {
    const { container, props } = renderModal({ hasPrevious: true, hasNext: true })
    const { getByRole } = within(container)
    const dialog = getByRole('dialog')

    swipe(dialog, { x: 100, y: 180 }, { x: 100, y: 80 })
    expect(props.onShowNext).toHaveBeenCalledOnce()
    expect(props.onShowPrevious).not.toHaveBeenCalled()

    swipe(dialog, { x: 100, y: 80 }, { x: 100, y: 180 })
    expect(props.onShowPrevious).toHaveBeenCalledOnce()
  })
})