import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Pagination } from './Pagination'

beforeEach(() => {
  cleanup()
})

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

  it('renders a compact range for large page counts', () => {
    const onPageChange = vi.fn()

    const { getByRole, getAllByText } = render(
      <Pagination currentPage={10} totalPages={20} onPageChange={onPageChange} />,
    )

    expect(getByRole('button', { name: '1' })).toBeInTheDocument()
    expect(getByRole('button', { name: '9' })).toBeInTheDocument()
    expect(getByRole('button', { name: '10' })).toBeInTheDocument()
    expect(getByRole('button', { name: '11' })).toBeInTheDocument()
    expect(getByRole('button', { name: '20' })).toBeInTheDocument()
    expect(getAllByText('...')).toHaveLength(2)
  })
})
