import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { CatalogPage } from './CatalogPage'
import { mockCards } from '../../data/mockCards'

describe('CatalogPage', () => {
  it('filters, expands oracle, and opens details modal', async () => {
    const user = userEvent.setup()
    render(<CatalogPage />)

    const firstCard = mockCards[0]

    expect(screen.getByText(firstCard.name)).toBeInTheDocument()

    const queryInput = screen.getByRole('textbox', { name: /search cards/i })
    await user.clear(queryInput)
    await user.type(queryInput, firstCard.name)
    expect(screen.getByText(/Card information: 1 match/i)).toBeInTheDocument()
    expect(screen.getByText(firstCard.name)).toBeInTheDocument()

    const oracleToggle = screen.getByRole('button', {
      name: new RegExp(`toggle oracle text for ${firstCard.name}`, 'i'),
    })
    await user.click(oracleToggle)
    expect(oracleToggle).toHaveAttribute('aria-expanded', 'true')

    await user.click(
      screen.getByRole('button', {
        name: new RegExp(`open details for ${firstCard.name}`, 'i'),
      }),
    )
    expect(
      screen.getByRole('dialog', {
        name: new RegExp(`${firstCard.name} details`, 'i'),
      }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(
      screen.queryByRole('dialog', {
        name: new RegExp(`${firstCard.name} details`, 'i'),
      }),
    ).not.toBeInTheDocument()
  })
})
