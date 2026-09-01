import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Card } from '../../../../types/card'
import { List } from './List'

vi.mock('./components/Cards/Cards', () => ({
  Cards: ({ card }: { card: Card }) => <div>{card.id}</div>,
}))

function card(id: string, addedAt?: string): Card {
  return {
    id,
    set: 'tst',
    rarity: 'common',
    addedAt,
    faces: [{
      name: id,
      manaCost: '',
      typeLine: 'Artifact',
      oracleText: '',
      colors: [],
      imageUrl: '',
    }],
  }
}

describe('List', () => {
  it('renders a sticky section for each date and an unknown-date fallback', () => {
    render(
      <List
        cards={[
          card('newest', '2026-09-01'),
          card('also-newest', '2026-09-01'),
          card('older', '2026-08-31'),
          card('legacy'),
        ]}
        showAddedDateGroups
        expandedOracles={{}}
        onToggleOracle={() => {}}
        onOpenDetails={() => {}}
      />,
    )

    expect(screen.getAllByRole('heading')).toHaveLength(3)
    expect(screen.getByRole('heading', { name: 'Unknown date' })).toBeInTheDocument()
    expect(screen.getByText('newest').parentElement).toContainElement(screen.getByText('also-newest'))
    expect(screen.getByText('older').parentElement).toHaveTextContent('older')
  })
})