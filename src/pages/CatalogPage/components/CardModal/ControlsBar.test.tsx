import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ControlsBar } from './ControlsBar'
import type { Card } from '../../../../types/card'

afterEach(() => cleanup())

const mockCard: Card = {
  id: 'card-1',
  oracleId: 'oracle-1',
  rarity: 'common',
  set: 'hob',
  collectorNumber: '1',
  faces: [
    {
      name: 'Test Card',
      typeLine: 'Creature',
      manaCost: '{1}',
      oracleText: 'Test text',
      colors: [],
      imageUrl: 'http://example.com/image.jpg',
    },
  ],
}

describe('ControlsBar', () => {
  it('renders buttons in the correct layout order: Scryfall, Rulings, Up, Close, Down', () => {
    render(
      <ControlsBar
        card={mockCard}
        hasRulings={true}
        rulingsOpen={false}
        onToggleRulings={vi.fn()}
        onShowPrevious={vi.fn()}
        onShowNext={vi.fn()}
        onClose={vi.fn()}
        hasPrevious={true}
        hasNext={true}
      />,
    )

    const controlsContainer = screen.getByRole('link', { name: /scryfall/i }).parentElement
    expect(controlsContainer).not.toBeNull()

    const children = Array.from(controlsContainer!.children)
    expect(children).toHaveLength(5)

    // 1. Scryfall
    expect(children[0]).toHaveAttribute('aria-label', 'Open card on Scryfall')
    // 2. Rulings
    expect(children[1]).toHaveAttribute('aria-label', 'Toggle rulings')
    // 3. Up (Previous)
    expect(children[2]).toHaveAttribute('aria-label', 'Previous')
    expect(children[2].textContent?.trim()).toBe('▲')
    // 4. Close
    expect(children[3]).toHaveAttribute('aria-label', 'Close')
    expect(children[3].textContent?.trim()).toBe('✖')
    // 5. Down (Next)
    expect(children[4]).toHaveAttribute('aria-label', 'Next')
    expect(children[4].textContent?.trim()).toBe('▼')
  })
})
