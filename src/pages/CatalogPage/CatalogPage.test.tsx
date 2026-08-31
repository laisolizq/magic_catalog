import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { CatalogPage } from './CatalogPage'
import { mockCards } from '../../data/mockCards'
import { clearCatalogDatabase } from '../../db/sqliteClient'
import { seedCatalogFixture } from '../../test/catalogFixture'

afterEach(() => cleanup())
beforeEach(async () => seedCatalogFixture())
afterEach(async () => {
  await clearCatalogDatabase()
})

describe('CatalogPage', () => {
  it('filters, expands oracle, and opens details modal', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/catalog?q=s%3Ahob']}>
        <CatalogPage />
      </MemoryRouter>,
    )

    // The default sort is 'Recently Added' (added-desc); the fixture has no
    // addedAt data, so ties fall back to name-ascending order.
    const firstCard = mockCards
      .filter((card) => card.set === 'hob')
      .sort((a, b) => {
        const left = a.faces[0]?.name ?? ''
        const right = b.faces[0]?.name ?? ''
        return left.localeCompare(right)
      })[0]
    const firstName = firstCard?.faces?.[0]?.name ?? ''

    expect(await screen.findByText(firstName)).toBeInTheDocument()

    const queryInput = screen.getByPlaceholderText(/search cards or filters/i)
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

  it('sorts by selected option and keeps sort after filtering', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/catalog?q=s%3Ahob']}>
        <CatalogPage />
      </MemoryRouter>,
    )

    // The app defaults to the hob set (s:hob) on load, sorted by 'Recently
    // Added'; the fixture has no addedAt data, so this also ties out to
    // name-ascending order (same as explicitly picking the 'Name' sort below).
    const expectedFirstByNameAsc = mockCards
      .filter((card) => card.set === 'hob')
      .sort((a, b) => {
        const left = a.faces[0]?.name ?? ''
        const right = b.faces[0]?.name ?? ''
        return left.localeCompare(right)
      })[0]
      ?.faces[0]?.name

    expect(await screen.findByText(expectedFirstByNameAsc)).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', {
        name: /sort cards/i,
      }),
    )

    await user.click(
      screen.getByRole('menuitemradio', {
        name: 'Name',
      }),
    )

    expect(
      screen.queryByRole('menu', {
        name: /sort options/i,
      }),
    ).not.toBeInTheDocument()

    expect(await screen.findByText(expectedFirstByNameAsc)).toBeInTheDocument()

    const firstOpenDetailsButton = (await screen.findAllByRole('button', {
      name: /open details for/i,
    }))[0]

    expect(firstOpenDetailsButton).toHaveAttribute(
      'aria-label',
      `Open details for ${expectedFirstByNameAsc}`,
    )

    const queryInput = screen.getByPlaceholderText(/search cards or filters/i)
    await user.clear(queryInput)
    await user.type(queryInput, 'a')

    await user.click(
      screen.getByRole('button', {
        name: /sort cards/i,
      }),
    )

    expect(
      screen.getByRole('menuitemradio', {
        name: 'Name ↑/↓',
      }),
    ).toHaveAttribute('aria-checked', 'true')
  })
})
