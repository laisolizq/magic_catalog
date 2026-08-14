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
    const firstName = firstCard.faces?.[0]?.name ?? ''

    expect(screen.getByText(firstName)).toBeInTheDocument()

    const queryInput = screen.getByPlaceholderText(/set:tla/i)
    await user.clear(queryInput)
    await user.type(queryInput, firstName)
    expect(screen.getByText(firstName)).toBeInTheDocument()

    const oracleToggle = screen.getByRole('button', {
      name: new RegExp(`toggle oracle text for ${firstName}`, 'i'),
    })
    await user.click(oracleToggle)
    expect(oracleToggle).toHaveAttribute('aria-expanded', 'true')

    await user.click(
      screen.getByRole('button', {
        name: new RegExp(`open details for ${firstName}`, 'i'),
      }),
    )
    expect(
      screen.getByRole('dialog', {
        name: new RegExp(`${firstName} details`, 'i'),
      }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /close/i }))
    expect(
      screen.queryByRole('dialog', {
        name: new RegExp(`${firstName} details`, 'i'),
      }),
    ).not.toBeInTheDocument()
  })
})
