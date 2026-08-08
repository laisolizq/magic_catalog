import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Pagination } from './Pagination'

describe('Pagination', () => {
  it('navigates pages when controls are clicked', () => {
    const onPageChange = vi.fn()

    render(<Pagination currentPage={2} totalPages={3} onPageChange={onPageChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Prev' }))
    expect(onPageChange).toHaveBeenCalledWith(1)

    fireEvent.click(screen.getByRole('button', { name: '3' }))
    expect(onPageChange).toHaveBeenCalledWith(3)

    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(onPageChange).toHaveBeenCalledWith(3)
  })
})
