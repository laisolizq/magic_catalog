import { fireEvent, render, screen } from '@testing-library/react'
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
})