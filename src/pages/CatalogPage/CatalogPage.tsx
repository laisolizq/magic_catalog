import { useEffect, useMemo, useRef, useState } from 'react'

import { AppHeader } from '../../App/components/AppHeader/AppHeader'
import { List } from './components/List/List'
import { SearchBar } from './components/SearchBar/SearchBar'
import { CardModal } from './components/CardModal/CardModal'
import { mockCards } from '../../data/mockCards'
import type { Card } from '../../types/card'
import {
  filterCards,
  getUniqueSets,
  getUniqueTypes,
  type ColorFilterMode,
} from '../../utils/cardFilters'
import { buildScryfallQuery, parseScryfallQuery } from '../../utils/scryfallQuery'
import { SCROLL_SENSITIVITY } from '../../config/ui'
import './CatalogPage.css'

const BATCH_SIZE = 12

type SortOption =
  | 'set-asc'
  | 'set-desc'
  | 'name-asc'
  | 'name-desc'
  | 'cmc-asc'
  | 'cmc-desc'

function getFaceName(card: Card): string {
  return card.faces[0]?.name ?? ''
}

function manaValueFromCost(cost: string): number {
  if (!cost) return 0

  const symbols = Array.from(
    cost.matchAll(/\{([^}]+)\}/g),
    (m) => m[1],
  )

  return symbols.reduce((total, symbol) => {
    if (/^\d+$/.test(symbol)) return total + Number(symbol)

    if (symbol === 'X' || symbol === 'Y' || symbol === 'Z') {
        return total
      }

      if (symbol.includes('/')) {
      if (symbol.startsWith('2/')) return total + 2
        return total + 1
      }

    if (symbol === 'H') return total + 1
    if (/^H[WUBRG]$/.test(symbol)) return total + 0.5
    if (/^[WUBRGCSPL]$/.test(symbol)) return total + 1

      return total
  }, 0)
}

function sortCards(
  cards: Card[],
  sortOption: SortOption,
): Card[] {
  // The mock data is already in set/number order, so ascending set sort is
  // just the original order and descending is its reverse.
  if (sortOption === 'set-asc') return cards
  if (sortOption === 'set-desc') return [...cards].reverse()

  const sorted = [...cards]

  sorted.sort((left, right) => {
    switch (sortOption) {
      case 'name-asc':
        return getFaceName(left).localeCompare(
          getFaceName(right),
        )

      case 'name-desc':
        return getFaceName(right).localeCompare(
          getFaceName(left),
        )

      case 'cmc-asc': {
        const delta =
          manaValueFromCost(left.faces[0]?.manaCost ?? '') -
          manaValueFromCost(right.faces[0]?.manaCost ?? '')

        if (delta !== 0) return delta

        return getFaceName(left).localeCompare(
          getFaceName(right),
        )
      }

      case 'cmc-desc': {
        const delta =
          manaValueFromCost(right.faces[0]?.manaCost ?? '') -
          manaValueFromCost(left.faces[0]?.manaCost ?? '')

        if (delta !== 0) return delta

        return getFaceName(left).localeCompare(
          getFaceName(right),
        )
      }

      default:
        return 0
    }
  })

  return sorted
}

function getDisplayCards(): Card[] {
  return mockCards
}

export function CatalogPage() {
  /*
   * The query is the single source of truth for:
   *
   * - text
   * - set
   * - type
   * - rarity
   * - selected colors
   * - color mode
   *
   * Examples:
   *
   *   s:hob
   *   c=w
   *   c>=wu
   *   c<=wu
   *   dragon c>=wu t:creature r:r
   */
  const [query, setQuery] =
    useState('s:hob')

  const parsedQuery = useMemo(
    () => parseScryfallQuery(query),
    [query],
  )

  const setValue = parsedQuery.sets
  const typeValue = parsedQuery.types
  const rarityValue =
    parsedQuery.rarities
  const colorValue = parsedQuery.colors
  const colorMode = parsedQuery.colorMode

  const [
    showAllPrints,
    setShowAllPrints,
  ] = useState(false)

  const [visibleCount, setVisibleCount] =
    useState(BATCH_SIZE)

  const [selectedCard, setSelectedCard] =
    useState<Card | null>(null)

  const [selectedFaceIndex, setSelectedFaceIndex] =
    useState<number>(0)

  const [expandedOracles, setExpandedOracles] =
    useState<Record<string, boolean>>({})

  const [expandAllCards, setExpandAllCards] =
    useState(false)

  const [isSearchVisible, setIsSearchVisible] =
    useState(true)

  const [isAdvancedOpen, setIsAdvancedOpen] =
    useState(false)

  const [sortOption, setSortOption] =
    useState<SortOption>('set-asc')

  const sentinelRef = useRef<HTMLDivElement>(null)
  const lastScrollY = useRef(0)
  const ignoreScrollRef = useRef(false)

  const displayCards = useMemo(
    () => getDisplayCards(),
    [],
  )

  /*
   * FILTERING
   *
   * Different filter categories are combined
   * with AND.
   *
   * Values inside one category are OR.
   *
   * Example:
   *
   * (W OR U)
   * AND
   * (rare OR mythic)
   */
  const filteredCards = useMemo(
    () =>
      filterCards(displayCards, {
        query: parsedQuery.text,
        set: setValue,
        type: typeValue,
        rarity: rarityValue,
        color: colorValue,
        colorMode,
      }),
    [
      displayCards,
      parsedQuery,
      setValue,
      typeValue,
      rarityValue,
      colorValue,
      colorMode,
    ],
  )

  const sortedFilteredCards = useMemo(() => {
    const sorted = sortCards(filteredCards, sortOption)

    if (showAllPrints) return sorted

    const seenNames = new Set<string>()

      return sorted.filter((card) => {
        const name = getFaceName(card)

      if (seenNames.has(name)) return false

        seenNames.add(name)
        return true
      })
  }, [filteredCards, sortOption, showAllPrints])

  /*
   * SEARCH BAR OPTIONS
   */

  const setOptions = useMemo(
    () => getUniqueSets(displayCards),
    [displayCards],
  )

  const typeOptions = useMemo(
    () => getUniqueTypes(displayCards),
    [displayCards],
  )

  /*
   * SCROLL
   */

  // Jump back to the top of the list whenever the query (search text or
  // filters) or the sort order changes, but not on the initial mount.
  const isFirstQueryOrSortRenderRef = useRef(true)

  useEffect(() => {
    if (isFirstQueryOrSortRenderRef.current) {
      isFirstQueryOrSortRenderRef.current = false
      return
    }

    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [query, sortOption, colorMode])

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY

      if (ignoreScrollRef.current) {
        lastScrollY.current = currentScrollY
        return
      }

      // Keep the search/filters visible while using advanced filters.
      if (isAdvancedOpen) {
        setIsSearchVisible(true)
        lastScrollY.current = currentScrollY
        return
      }

      const delta = currentScrollY - lastScrollY.current

      if (currentScrollY <= 0) {
        setIsSearchVisible(true)
        lastScrollY.current = currentScrollY
        return
      }

      if (delta < -SCROLL_SENSITIVITY) {
        setIsSearchVisible(true)
        lastScrollY.current = currentScrollY
      } else if (delta > SCROLL_SENSITIVITY) {
        setIsSearchVisible(false)
        lastScrollY.current = currentScrollY
      }
    }

    window.addEventListener('scroll', handleScroll, {
        passive: true,
    })

    return () =>
      window.removeEventListener(
        'scroll',
        handleScroll,
      )
  }, [isAdvancedOpen])

  /*
   * INFINITE SCROLL
   */

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setVisibleCount((prev) =>
              Math.min(
                prev + BATCH_SIZE,
                sortedFilteredCards.length,
              ),
            )
          }
        },
      { rootMargin: '300px' },
      )

    observer.observe(sentinel)

    return () => observer.disconnect()
  }, [sortedFilteredCards.length])

  /*
   * Visible cards
   */

  const visibleCardsSorted =
    sortedFilteredCards.slice(0, visibleCount)

  /*
   * EXPAND ORACLES
   */

  const expandedOraclesView = expandAllCards
      ? Object.fromEntries(
        sortedFilteredCards.map((card) => [
              card.id,
              true,
        ]),
        )
      : expandedOracles

  /*
   * MODAL
   */

  const modalCards =
    sortedFilteredCards

  const selectedCardIndex = selectedCard
      ? modalCards.findIndex(
        (card) => card.id === selectedCard.id,
        )
      : -1

  const showPreviousCard = () => {
    if (selectedCardIndex <= 0) return

    setSelectedCard(
      modalCards[selectedCardIndex - 1],
    )
  }

  const showNextCard = () => {
    if (
      selectedCardIndex < 0 ||
      selectedCardIndex >= modalCards.length - 1
    ) {
      return
    }

    setSelectedCard(
      modalCards[selectedCardIndex + 1],
    )
  }

  const scrollToCard = (
    cardId?: string,
    faceIndex?: number,
  ) => {
    if (!cardId) return

    let selector = `[data-card-id="${cardId}"]`

    if (typeof faceIndex === 'number') {
      selector += `[data-face-index="${faceIndex}"]`
    }

    const el = document.querySelector(
        selector,
      ) as HTMLElement | null

    if (el) {
      el.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      })
    }
  }

  /*
   * EXPAND ALL
   */

  const handleExpandAllChange = (
    checked: boolean,
  ) => {
    const currentScrollY = window.scrollY

    ignoreScrollRef.current = true

    setExpandAllCards(checked)

    if (checked) {
      const expanded: Record<string, boolean> = {}

      sortedFilteredCards.forEach((card) => {
          expanded[card.id] = true
      })

      setExpandedOracles(expanded)
    } else {
      setExpandedOracles({})
    }

    setIsSearchVisible(true)

    requestAnimationFrame(() => {
      window.scrollTo({
        top: currentScrollY,
        behavior: 'instant',
      })

      lastScrollY.current = currentScrollY

      requestAnimationFrame(() => {
        ignoreScrollRef.current = false
        lastScrollY.current = window.scrollY
        setIsSearchVisible(true)
      })
    })
  }

  /*
   * SORT
   */

  const handleSortChange = (
    value: SortOption,
  ) => {
    setSortOption(value)
    setVisibleCount(BATCH_SIZE)
  }

  /*
   * FILTER CHANGES
   *
   * Whenever a filter changes:
   *
   * - reset pagination
   * - reset expanded oracles
   *
   * (Scrolling back to the top when the query changes is handled by the
   * effect watching `query`/`sortOption` above.)
   */

  const handleFilterChange = (
    callback: () => void,
  ) => {
    callback()

    setVisibleCount(BATCH_SIZE)

    if (!expandAllCards) {
      setExpandedOracles({})
    }
  }

  /*
   * Rewrites the query string when a filter control (dropdown/advanced
   * filters) changes, keeping the current free text and other fields intact.
   *
   * Uses the functional setState form so multiple calls fired back-to-back
   * (e.g. Advanced Filters applying color/type/rarity/set at once) each
   * build on the previous update instead of all reading the same stale
   * `parsedQuery` and clobbering one another.
   */
  const updateQueryFilters = (
    updates: Partial<{
      colors: string[]
      types: string[]
      rarities: string[]
      sets: string[]
    }>,
  ) => {
    handleFilterChange(() =>
      setQuery((prevQuery) => {
        const prevParsed = parseScryfallQuery(prevQuery)

        return buildScryfallQuery({
          text: prevParsed.text,
          colors: prevParsed.colors,
          colorMode:
            prevParsed.colorMode,
          types: prevParsed.types,
          rarities: prevParsed.rarities,
          sets: prevParsed.sets,
          ...updates,
        })
      }),
    )
  }

  /*
   * COLOR MODE
   *
   * The mode is part of the query itself.
   *
   * exactly:
   *   c=wu
   *
   * including:
   *   c>=wu
   *
   * atMost:
   *   c<=wu
   */
  const handleColorModeChange = (
    value: ColorFilterMode,
  ) => {
    handleFilterChange(() =>
      setQuery((prevQuery) => {
        const parsed =
          parseScryfallQuery(
            prevQuery,
          )

        return buildScryfallQuery({
          text: parsed.text,
          colors: parsed.colors,
          colorMode: value,
          types: parsed.types,
          rarities: parsed.rarities,
          sets: parsed.sets,
        })
      }),
    )
  }

  /*
   * ADVANCED VIEW
   *
   * The + button changes the view instead of opening
   * the old inline advanced row.
   */

  const handleAdvancedOpenChange = (
    value: boolean,
  ) => {
    const currentScrollY = window.scrollY

    ignoreScrollRef.current = true

    setIsAdvancedOpen(value)
    setIsSearchVisible(true)

    requestAnimationFrame(() => {
      window.scrollTo({
        top: currentScrollY,
        behavior: 'instant',
      })

      lastScrollY.current = currentScrollY

      requestAnimationFrame(() => {
        ignoreScrollRef.current = false
        lastScrollY.current = window.scrollY
      })
    })
  }

  return (
    <section
      className="catalog-page"
      aria-label="Catalog Page"
    >
      <div
        className={`search-bar-wrapper ${
          isAdvancedOpen || isSearchVisible
            ? 'search-visible'
            : 'search-hidden'
        }`}
      >
        <AppHeader />

        <SearchBar
          query={query}
          setValue={setValue}
          typeValue={typeValue}
          rarityValue={rarityValue}
          colorValue={colorValue}
          colorMode={colorMode}
          sortOption={sortOption}
          setOptions={setOptions}
          typeOptions={typeOptions}
          isAdvancedOpen={isAdvancedOpen}
          expandAllCards={expandAllCards}
          showAllPrints={showAllPrints}
          onAdvancedOpenChange={
            handleAdvancedOpenChange
          }
          onExpandAllChange={
            handleExpandAllChange
          }
          onSortChange={handleSortChange}
          onQueryChange={(value) =>
            handleFilterChange(() =>
              setQuery(value),
            )
          }
          onSetChange={(value) =>
            updateQueryFilters({ sets: value })
          }
          onTypeChange={(value) =>
            updateQueryFilters({ types: value })
          }
          onRarityChange={(value) =>
            updateQueryFilters({ rarities: value })
          }
          onColorChange={(value) =>
            updateQueryFilters({ colors: value })
          }
          onColorModeChange={ handleColorModeChange }
          onShowAllPrintsChange={(value) =>
            handleFilterChange(() =>
              setShowAllPrints(value),
            )
          }
        />
      </div>

      <List
        cards={visibleCardsSorted}
        expandedOracles={expandedOraclesView}
        onToggleOracle={(cardId) =>
          setExpandedOracles((prev) => ({
              ...prev,
            [cardId]: !prev[cardId],
          }))
        }
        onOpenDetails={(card, faceIndex = 0) => {
          setSelectedFaceIndex(faceIndex)
          setSelectedCard(card)
        }}
      />

      <div
        ref={sentinelRef}
        aria-hidden="true"
      />

      {selectedCard && (
        <CardModal
          card={selectedCard}
          initialFaceIndex={selectedFaceIndex}
          onClose={() => {
            const cardId = selectedCard?.id
            const faceIdx = selectedFaceIndex

            setSelectedCard(null)

            requestAnimationFrame(() => {
              scrollToCard(cardId, faceIdx)
            })
          }}
          onShowPrevious={showPreviousCard}
          onShowNext={showNextCard}
          hasPrevious={selectedCardIndex > 0}
          hasNext={
            selectedCardIndex >= 0 &&
            selectedCardIndex <
              modalCards.length - 1
          }
          previousCard={
            selectedCardIndex > 0
              ? modalCards[
                  selectedCardIndex - 1
                ]
              : null
          }
          nextCard={
            selectedCardIndex >= 0 &&
            selectedCardIndex <
              modalCards.length - 1
              ? modalCards[
                  selectedCardIndex + 1
                ]
              : null
          }
        />
      )}
    </section>
  )
}