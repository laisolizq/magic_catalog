import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CatalogPage, resolveDefaultSort } from './CatalogPage'
import { mockCards } from '../../data/mockCards'
import { clearCatalogDatabase } from '../../db/sqliteClient'
import { seedCards, seedCatalogFixture } from '../../test/catalogFixture'
import * as sqliteCardQuery from '../../services/sqliteCardQuery'
import { parseScryfallQuery } from '../../utils/scryfallQuery'

afterEach(() => cleanup())
beforeEach(async () => seedCatalogFixture())
afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  await clearCatalogDatabase()
})

describe('CatalogPage', () => {
  it('scrolls to the first row after a changed query renders', async () => {
    const user = userEvent.setup()
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})

    render(
      <MemoryRouter initialEntries={['/catalog?q=s%3Ahob']}>
        <CatalogPage />
      </MemoryRouter>,
    )

    const queryInput = await screen.findByPlaceholderText(/search cards or filters/i)
    await user.clear(queryInput)
    await user.type(queryInput, 'Along the Crooked Way')

    await waitFor(() => {
      expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' })
    })
  })

  it('resolves Default sorting from the query and set release date', () => {
    const setOptions = [
      { code: 'released', name: 'Released Set', releasedAt: '2025-01-01', setType: 'expansion' },
      { code: 'future', name: 'Future Set', releasedAt: '2999-01-01', setType: 'expansion' },
    ]

    expect(resolveDefaultSort(parseScryfallQuery(''), setOptions)).toBe('added-desc')
    expect(resolveDefaultSort(parseScryfallQuery('s:released'), setOptions)).toBe('set-asc')
    expect(resolveDefaultSort(parseScryfallQuery('s:future'), setOptions)).toBe('added-desc')
    expect(resolveDefaultSort(parseScryfallQuery('s:unknown'), setOptions)).toBe('added-desc')
    expect(resolveDefaultSort(parseScryfallQuery('c=w t:enchantment'), setOptions)).toBe('name-asc')
    expect(resolveDefaultSort(parseScryfallQuery('angel'), setOptions)).toBe('name-asc')
  })

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

  it('prefetches and appends SQL pages with an offset', async () => {
    const cards = Array.from({ length: 30 }, (_, index) => ({
      ...mockCards[0],
      id: `paged-card-${index.toString().padStart(2, '0')}`,
      collectorNumber: String(index),
      faces: [{
        ...mockCards[0].faces[0],
        name: `Paged Card ${index.toString().padStart(2, '0')}`,
      }],
    }))
    await seedCards(cards)

    let intersectionCallback: IntersectionObserverCallback | undefined
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) {
        intersectionCallback = callback
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    })
    const queryCards = vi.spyOn(sqliteCardQuery, 'queryCards')

    render(
      <MemoryRouter initialEntries={['/catalog?all=1&sort=name-asc']}>
        <CatalogPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /open details for/i })).toHaveLength(12)
    })
    expect(queryCards).toHaveBeenCalledWith(expect.objectContaining({
      limit: 12,
      offset: 0,
    }))
    await waitFor(() => {
      expect(queryCards).toHaveBeenCalledWith(expect.objectContaining({
        limit: 12,
        offset: 12,
      }))
    })
    expect(screen.getAllByRole('button', { name: /open details for/i })).toHaveLength(12)

    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      )
    })

    await waitFor(() => {
      expect(queryCards).toHaveBeenCalledWith(expect.objectContaining({
        limit: 6,
        offset: 24,
      }))
      expect(screen.getAllByRole('button', { name: /open details for/i })).toHaveLength(24)
    })
  })

  it('starts the default query before the scroll sentinel can alter its batch', async () => {
    let hasIntersected = false
    vi.stubGlobal('IntersectionObserver', class {
      private callback: IntersectionObserverCallback

      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback
      }

      observe() {
        if (hasIntersected) return
        hasIntersected = true
        this.callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        )
      }

      unobserve() {}
      disconnect() {}
    })
    const queryCards = vi.spyOn(sqliteCardQuery, 'queryCards')

    render(
      <MemoryRouter initialEntries={['/catalog']}>
        <CatalogPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(queryCards.mock.calls[0]?.[0]).toEqual(expect.objectContaining({
        text: '',
        sortOption: 'added-desc',
        limit: 12,
        offset: 0,
      }))
      expect(screen.getAllByRole('button', { name: /open details for/i }).length).toBeGreaterThan(0)
    })
    expect(queryCards).not.toHaveBeenCalledWith(expect.objectContaining({ limit: 0 }))
  })
})
