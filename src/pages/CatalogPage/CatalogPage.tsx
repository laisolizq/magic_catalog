import { useEffect, useMemo, useRef, useState } from 'react'

import { List } from './components/List/List'
import { SearchBar } from './components/SearchBar/SearchBar'
import { CardModal } from './components/CardModal/CardModal'
import type { Card } from '../../types/card'
import {
  buildScryfallQuery,
  parseScryfallQuery,
  type ColorFilterMode,
} from '../../utils/scryfallQuery'
import { SCROLL_SENSITIVITY } from '../../config/ui'
import { queryCards, getCatalogTypes } from '../../services/sqliteCardQuery'
import {
  bootstrapCatalogFromEmbeddedAssets,
  updateCatalogFromLatestRelease,
  type CatalogUpdateStatus,
} from '../../services/catalogUpdates'
import { hasLocalCatalog, type CatalogImportProgress } from '../../services/catalogImport'
import './CatalogPage.css'

const BATCH_SIZE = 12
const SYMBOL_TYPE_FILTERS = [
  'artifact',
  'battle',
  'creature',
  'enchantment',
  'instant',
  'land',
  'planeswalker',
  'sorcery',
] as const

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

function collectorSortKey(value: string | undefined): [number, string] {
  const match = value?.match(/^(\d+)(.*)$/)
  if (!match) return [Number.MAX_SAFE_INTEGER, value ?? '']
  return [Number(match[1]), match[2].toLowerCase()]
}

function compareSetOrder(left: Card, right: Card): number {
  const setDelta = left.set.localeCompare(right.set)
  if (setDelta !== 0) return setDelta

  const [leftNumber, leftSuffix] = collectorSortKey(left.collectorNumber)
  const [rightNumber, rightSuffix] = collectorSortKey(right.collectorNumber)
  return (
    leftNumber - rightNumber ||
    leftSuffix.localeCompare(rightSuffix) ||
    left.id.localeCompare(right.id)
  )
}

function comparePrintingPreference(left: Card, right: Card): number {
  const leftIsMajor = left.setType === 'core' || left.setType === 'expansion'
  const rightIsMajor = right.setType === 'core' || right.setType === 'expansion'
  if (leftIsMajor !== rightIsMajor) return leftIsMajor ? 1 : -1

  const releaseDelta = (left.releasedAt ?? '').localeCompare(right.releasedAt ?? '')
  if (releaseDelta !== 0) return releaseDelta

  const setDelta = left.set.localeCompare(right.set)
  if (setDelta !== 0) return setDelta

  const [leftNumber, leftSuffix] = collectorSortKey(left.collectorNumber)
  const [rightNumber, rightSuffix] = collectorSortKey(right.collectorNumber)
  return (
    rightNumber - leftNumber ||
    rightSuffix.localeCompare(leftSuffix) ||
    right.id.localeCompare(left.id)
  )
}

function selectLatestPrintings(cards: Card[]): Card[] {
  const latestByName = new Map<string, Card>()
  const cardsByName = new Map<string, Card[]>()

  cards.forEach((card) => {
    const name = getFaceName(card)
    const printings = cardsByName.get(name) ?? []
    printings.push(card)
    cardsByName.set(name, printings)
  })

  cardsByName.forEach((printings, name) => {
    const majorPrintings = printings.filter(
      (card) => card.setType === 'core' || card.setType === 'expansion',
    )
    const candidates = majorPrintings.length > 0 ? majorPrintings : printings
    const preferred = candidates.slice(1).reduce<Card>((current, card) => {
      return comparePrintingPreference(card, current) > 0
        ? card
        : current
    }, candidates[0])

    latestByName.set(name, preferred)
  })

  return cards.filter((card) => latestByName.get(getFaceName(card)) === card)
}

function sortCards(
  cards: Card[],
  sortOption: SortOption,
): Card[] {
  const sorted = [...cards]

  sorted.sort((left, right) => {
    switch (sortOption) {
      case 'set-asc':
        return compareSetOrder(left, right)

      case 'set-desc':
        return -compareSetOrder(left, right)

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

  const [displayCards, setDisplayCards] = useState<Card[]>([])
  const [typeOptions, setTypeOptions] = useState<string[]>([])
  const [isCatalogLoading, setIsCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [isCatalogReady, setIsCatalogReady] = useState(false)
  const [catalogProgress, setCatalogProgress] = useState<CatalogImportProgress>({
    phase: 'Starting catalog import',
    percent: 0,
  })
  const catalogBootstrapRef = useRef<Promise<CatalogUpdateStatus> | null>(null)

  const sentinelRef = useRef<HTMLDivElement>(null)
  const lastScrollY = useRef(0)
  const ignoreScrollRef = useRef(false)
  const hasLoadedCatalogRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function bootstrapCatalog() {
      const hasCatalogBeforeUpdate = await hasLocalCatalog()

      if (hasCatalogBeforeUpdate) {
        if (!cancelled) setIsCatalogReady(true)

        if (!catalogBootstrapRef.current) {
          catalogBootstrapRef.current = updateCatalogFromLatestRelease(setCatalogProgress)
        }

        void catalogBootstrapRef.current.catch((error) => {
          console.error('[catalog] background update failed', error)
        })
        return
      }

      const bootstrapStatus = await bootstrapCatalogFromEmbeddedAssets(setCatalogProgress)
      const hasCatalogAfterBootstrap = await hasLocalCatalog()

      if (hasCatalogAfterBootstrap) {
        if (!cancelled) setIsCatalogReady(true)

        if (!catalogBootstrapRef.current) {
          catalogBootstrapRef.current = updateCatalogFromLatestRelease(setCatalogProgress)
        }

        void catalogBootstrapRef.current.catch((error) => {
          console.error('[catalog] background update failed', error)
        })
        return
      }

      if (bootstrapStatus === 'failed') {
        console.warn('[catalog] starter catalog bootstrap failed')
      }

      if (!catalogBootstrapRef.current) {
        catalogBootstrapRef.current = updateCatalogFromLatestRelease(setCatalogProgress)
      }

      const status = await catalogBootstrapRef.current
      const hasCatalog = await hasLocalCatalog()

      if (cancelled) return

      if (!hasCatalog && status !== 'updated') {
        setCatalogError(
          'The card catalog is not available. Start the local artifact server or check your network connection.',
        )
        setIsCatalogLoading(false)
        return
      }

      setIsCatalogReady(true)
    }

    void bootstrapCatalog().catch((error) => {
      console.error('[catalog] bootstrap failed', error)
      if (cancelled) return
      setCatalogError('Unable to initialize the card catalog.')
      setIsCatalogLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isCatalogReady) return

    let cancelled = false

    async function loadCatalog() {
      if (!hasLoadedCatalogRef.current) {
        setIsCatalogLoading(true)
      }
      setCatalogError(null)

      try {
        const queryStartedAt = performance.now()
        const result = await queryCards({
          text: parsedQuery.text,
          sets: setValue,
          types: typeValue,
          rarities: rarityValue,
          colors: colorValue,
          colorMode,
        })
        console.log(`[catalog] card query completed in ${(performance.now() - queryStartedAt).toFixed(0)}ms`)

        if (cancelled) return
        setDisplayCards(result.cards)
        hasLoadedCatalogRef.current = true
      } catch (error) {
        if (cancelled) return
        setCatalogError(
          error instanceof Error ? error.message : 'Unable to load the card catalog.',
        )
        setDisplayCards([])
      } finally {
        if (!cancelled) setIsCatalogLoading(false)
      }
    }

    void loadCatalog()

    return () => {
      cancelled = true
    }
  }, [parsedQuery, setValue, typeValue, rarityValue, colorValue, colorMode, isCatalogReady])

  useEffect(() => {
    if (!isCatalogReady) return

    let cancelled = false

    getCatalogTypes().then((types) => {
      if (cancelled) return
      const supportedTypes = new Set(types.map((type) => type.toLowerCase()))
      setTypeOptions(
        SYMBOL_TYPE_FILTERS.filter((type) => supportedTypes.has(type)),
      )
    }).catch((error) => {
      console.error('[catalog] filter options failed', error)
    })

    return () => {
      cancelled = true
    }
  }, [isCatalogReady])

  const filteredCards = displayCards

  const sortedFilteredCards = useMemo(() => {
    const cardsToDisplay = showAllPrints
      ? filteredCards
      : selectLatestPrintings(filteredCards)

    return parsedQuery.text.trim()
      ? cardsToDisplay
      : sortCards(cardsToDisplay, sortOption)
  }, [filteredCards, sortOption, showAllPrints])

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
        <SearchBar
          query={query}
          typeValue={typeValue}
          rarityValue={rarityValue}
          colorValue={colorValue}
          colorMode={colorMode}
          sortOption={sortOption}
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
          onTypeChange={(value) =>
            updateQueryFilters({ types: value })
          }
          onRarityChange={(value) =>
            updateQueryFilters({ rarities: value })
          }
          onColorChange={(value) =>
            updateQueryFilters({ colors: value })
          }
          onColorModeChange={handleColorModeChange}
          onShowAllPrintsChange={(value) =>
            handleFilterChange(() =>
              setShowAllPrints(value),
            )
          }
        />
      </div>

      {isCatalogLoading ? (
        <p role="status">
          {catalogProgress.phase} ({catalogProgress.percent}%)
        </p>
      ) : catalogError ? (
        <p role="alert">{catalogError}</p>
      ) : (
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
      )}

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