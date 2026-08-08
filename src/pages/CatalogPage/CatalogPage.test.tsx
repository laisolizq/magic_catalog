import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { CatalogPage } from './CatalogPage'

describe('CatalogPage', () => {
  it('filters, paginates, expands oracle, and opens details modal', async () => {
    const user = userEvent.setup()
    render(<CatalogPage />)

    expect(screen.getByText('Costly Plunder')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Slickshot Show-Off')).toBeInTheDocument()

    const queryInput = screen.getByPlaceholderText(/search by card name/i)
    await user.clear(queryInput)
    await user.type(queryInput, 'Counterspell')
    expect(screen.getByText(/Card information: 1 match/i)).toBeInTheDocument()
    expect(screen.getByText('Counterspell')).toBeInTheDocument()

    const oracleToggle = screen.getByRole('button', { name: 'Card Oracle' })
    await user.click(oracleToggle)
    expect(oracleToggle).toHaveAttribute('aria-expanded', 'true')

    await user.click(screen.getByRole('button', { name: /open details for counterspell/i }))
    expect(
      screen.getByRole('dialog', { name: /Counterspell details/i }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(
      screen.queryByRole('dialog', { name: /Counterspell details/i }),
    ).not.toBeInTheDocument()
  })
})
