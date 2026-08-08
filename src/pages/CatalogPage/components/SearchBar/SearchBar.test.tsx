import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SearchBar } from './SearchBar'

describe('SearchBar', () => {
  it('calls change handlers', () => {
    const onQueryChange = vi.fn()
    const onSetChange = vi.fn()
    const onTypeChange = vi.fn()
    const onRarityChange = vi.fn()
    const onColorChange = vi.fn()

    render(
      <SearchBar
        query=""
        setValue="all"
        typeValue="all"
        rarityValue="all"
        colorValue="all"
        setOptions={['bro']}
        typeOptions={['Creature']}
        onQueryChange={onQueryChange}
        onSetChange={onSetChange}
        onTypeChange={onTypeChange}
        onRarityChange={onRarityChange}
        onColorChange={onColorChange}
      />,
    )

    fireEvent.change(screen.getByRole('textbox', { name: /search cards/i }), {
      target: { value: 'counterspell' },
    })
    expect(onQueryChange).toHaveBeenCalledWith('counterspell')

    expect(screen.queryByRole('combobox', { name: 'set' })).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /show advanced query options/i }),
    )

    fireEvent.change(screen.getByRole('combobox', { name: 'set' }), {
      target: { value: 'bro' },
    })
    expect(onSetChange).toHaveBeenCalledWith('bro')
  })
})
