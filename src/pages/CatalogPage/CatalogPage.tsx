import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { List } from './components/List/List'
import { SearchBar } from './components/SearchBar/SearchBar'
import { CardModal } from './components/CardModal/CardModal'
import { BasicCatalogChrome } from './components/CatalogChrome/BasicCatalogChrome'
import { AdvancedCatalogChrome } from './components/CatalogChrome/AdvancedCatalogChrome'
import type { Card } from '../../types/card'
import type { SetOption } from '../../types/catalog'
import {
  buildScryfallQuery,
  parseScryfallQuery,
  type ColorFilterMode,
} from '../../utils/scryfallQuery'
import { queryCards, getCatalogTypes, getCatalogSetOptions } from '../../services/sqliteCardQuery'
import {
  bootstrapCatalogFromEmbeddedAssets,
  updateCatalogFromLatestRelease,
  type CatalogUpdateStatus,
} from '../../services/catalogUpdates'
import { hasLocalCatalog, type CatalogImportProgress } from '../../services/catalogImport'
import { getCatalogDatabase } from '../../db/sqliteClient'
import { selectLatestPrintings } from './selectLatestPrintings'
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

interface QueryUrlParams {
  query: string
  sortOption: SortOption
  showAllPrints: boolean
  visibleCount: number
}

function encodeQueryParams(params: Partial<QueryUrlParams>): URLSearchParams {
  const encoded = new URLSearchParams()
  if (params.query) encoded.set('q', params.query)
  if (params.sortOption) encoded.set('sort', params.sortOption)
  if (params.showAllPrints) encoded.set('all', '1')
  if (params.visibleCount) encoded.set('batch', String(params.visibleCount))
  return encoded
}

function decodeQueryParams(search: string): Partial<QueryUrlParams> {
  const params = new URLSearchParams(search)
  return {
    query: params.get('q') || undefined,
    sortOption: (params.get('sort') as SortOption) || undefined,
    showAllPrints: params.has('all'),
    visibleCount: params.has('batch') ? Number(params.get('batch')) || undefined : undefined,
  }
}

function getLatestReleasedSet(setOptions: SetOption[]): SetOption | undefined {
  const now = new Date()
  // Filter sets that have been released (releasedAt <= now) and are core or expansion
  const releasedSets = setOptions.filter(set => 
    new Date(set.releasedAt) <= now && 
    (set.setType === 'core' || set.setType === 'expansion')
  )
  // Sort by release date descending and return the first (most recent)
  return releasedSets.sort((a, b) => 
    new Date(b.releasedAt).getTime() - new Date(a.releasedAt).getTime()
  )[0]
}

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
  const location = useLocation()
  const navigate = useNavigate()

  // Initialize state from URL params
  const urlParams = useMemo(() => decodeQueryParams(location.search), [location.search])
  const hasQueryFromUrl = Boolean(urlParams.query)

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
    useState(urlParams.query || '')

  const parsedQuery = useMemo(
    () => parseScryfallQuery(query),
    [query],
  )

  const setValue = parsedQuery.sets
  // typeOptions/selectedValues comparisons elsewhere are lowercase, but
  // parseScryfallQuery capitalizes types for display purposes.
  const typeValue = useMemo(
    () => parsedQuery.types.map((type) => type.toLowerCase()),
    [parsedQuery.types],
  )
  const rarityValue =
    parsedQuery.rarities
  const colorValue = parsedQuery.colors
  const colorMode = parsedQuery.colorMode

  const [
    showAllPrints,
    setShowAllPrints,
  ] = useState(urlParams.showAllPrints || false)

  const [visibleCount, setVisibleCount] =
    useState(urlParams.visibleCount || BATCH_SIZE)

  const [selectedCard, setSelectedCard] =
    useState<Card | null>(null)

  const [selectedFaceIndex, setSelectedFaceIndex] =
    useState<number>(0)

  const [expandedOracles, setExpandedOracles] =
    useState<Record<string, boolean>>({})

  const [expandAllCards, setExpandAllCards] =
    useState(false)

  const [isAdvancedOpen, setIsAdvancedOpen] =
    useState(false)

  const [sortOption, setSortOption] =
    useState<SortOption>(urlParams.sortOption || 'set-asc')

  const [displayCards, setDisplayCards] = useState<Card[]>([])
  const [typeOptions, setTypeOptions] = useState<string[]>([])
  const [setOptions, setSetOptions] = useState<SetOption[]>([])
  const [isCatalogLoading, setIsCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [isCatalogReady, setIsCatalogReady] = useState(false)
  const [catalogProgress, setCatalogProgress] = useState<CatalogImportProgress>({
    phase: '',
    percent: 0,
  })
  const catalogBootstrapRef = useRef<Promise<CatalogUpdateStatus> | null>(null)

  const sentinelRef = useRef<HTMLDivElement>(null)
  const ignoreScrollRef = useRef(false)
  const hasLoadedCatalogRef = useRef(false)
  const hasInitializedQueryRef = useRef(false)

  /*
   * SYNC STATE TO URL
   * Whenever query, sort, showAllPrints, or visibleCount change, update URL params
   * so refresh preserves the current search state
   */
  useEffect(() => {
    const params = encodeQueryParams({
      query,
      sortOption,
      showAllPrints,
      visibleCount,
    })
    const newSearch = params.toString() ? `?${params.toString()}` : ''
    
    if (newSearch !== location.search) {
      navigate(
        {
          pathname: location.pathname,
          search: newSearch,
        },
        { replace: true }
      )
    }
  }, [query, sortOption, showAllPrints, visibleCount, navigate, location.pathname, location.search])

  useEffect(() => {
    let cancelled = false

    async function bootstrapCatalog() {
      const hasCatalogBeforeUpdate = await hasLocalCatalog()

      if (hasCatalogBeforeUpdate) {
        void getCatalogDatabase().catch((error) => {
          console.error('[catalog] database warmup failed', error)
        })

        if (!cancelled) {
          setIsCatalogLoading(true)
          setIsCatalogReady(true)
        }

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
        if (!cancelled) {
          setIsCatalogLoading(true)
          setIsCatalogReady(true)
        }

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

      setIsCatalogLoading(true)
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
          oracle: parsedQuery.oracle,
          sets: setValue,
          types: typeValue,
          rarities: rarityValue,
          colors: colorValue,
          colorMode,
          colorCount: parsedQuery.colorCount,
        })
        console.log(`[catalog] card query ${JSON.stringify(parsedQuery)} completed in ${(performance.now() - queryStartedAt).toFixed(0)}ms`)

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

  useEffect(() => {
    if (!isCatalogReady) return

    let cancelled = false

    getCatalogSetOptions().then((options) => {
      if (cancelled) return
      setSetOptions(options)
    }).catch((error) => {
      console.error('[catalog] set options failed', error)
    })

    return () => {
      cancelled = true
    }
  }, [isCatalogReady])

  /*
   * UPDATE INITIAL QUERY TO LATEST RELEASED SET
   * If no query was provided in URL params, use the latest released set
   */
  useEffect(() => {
    if (hasQueryFromUrl || setOptions.length === 0 || hasInitializedQueryRef.current) return

    const latestSet = getLatestReleasedSet(setOptions)
    if (latestSet) {
      hasInitializedQueryRef.current = true
      // eslint-disable-next-line
      setQuery(`s:${latestSet.code}`)
    }
  }, [setOptions, hasQueryFromUrl])

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

  const scrollToCard = useCallback((
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
  }, [])

  const closeModal = useCallback(() => {
    if (!selectedCard) return

    const cardId = selectedCard.id
    const cardIndex = modalCards.findIndex((card) => card.id === cardId)

    if (cardIndex >= 0) {
      setVisibleCount((previous) => Math.max(previous, cardIndex + 1))
    }

    setSelectedCard(null)

    // The card may need to be rendered before it can be used as a scroll target.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToCard(cardId)
      })
    })
  }, [selectedCard, modalCards, scrollToCard])

  useEffect(() => {
    if (!selectedCard) return

    window.addEventListener('popstate', closeModal)
    return () => {
      window.removeEventListener('popstate', closeModal)
    }
  }, [selectedCard, closeModal])

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

    requestAnimationFrame(() => {
      window.scrollTo({
        top: currentScrollY,
        behavior: 'instant',
      })

      requestAnimationFrame(() => {
        ignoreScrollRef.current = false
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
      oracle: string
    }>,
  ) => {
    handleFilterChange(() =>
      setQuery((prevQuery) => {
        const prevParsed = parseScryfallQuery(prevQuery)

        return buildScryfallQuery({
          text: prevParsed.text,
          oracle: prevParsed.oracle,
          colors: prevParsed.colors,
          colorMode:
            prevParsed.colorMode,
          colorCount: prevParsed.colorCount,
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
          oracle: parsed.oracle,
          colors: parsed.colors,
          colorMode: value,
          colorCount: parsed.colorCount,
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

    requestAnimationFrame(() => {
      window.scrollTo({
        top: currentScrollY,
        behavior: 'instant',
      })

      requestAnimationFrame(() => {
        ignoreScrollRef.current = false
      })
    })
  }

  const catalogSearchBar = (
    <SearchBar
          query={query}
          typeValue={typeValue}
          rarityValue={rarityValue}
          colorValue={colorValue}
          colorMode={colorMode}
          oracleValue={parsedQuery.oracle}
          sortOption={sortOption}
          typeOptions={typeOptions}
          setValue={setValue}
          setOptions={setOptions}
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
          onOracleChange={(value) =>
            updateQueryFilters({ oracle: value })
          }
          onSetsChange={(value) =>
            updateQueryFilters({ sets: value })
          }
          onShowAllPrintsChange={(value) =>
            handleFilterChange(() =>
              setShowAllPrints(value),
            )
          }
    />
  )

  return (
    <section
      className="catalog-page"
      aria-label="Catalog Page"
    >
      {isAdvancedOpen ? (
        <AdvancedCatalogChrome>
          <div className="search-bar-wrapper">
            {catalogSearchBar}
          </div>
        </AdvancedCatalogChrome>
      ) : (
        <BasicCatalogChrome>
          <div className="search-bar-wrapper">
            {catalogSearchBar}
          </div>
        </BasicCatalogChrome>
      )}

      {catalogError ? (
        <p role="alert">{catalogError}</p>
      ) : !isCatalogReady ? null : isCatalogLoading ? (
        catalogProgress.phase ? (
          <p role="status">
            {catalogProgress.phase} ({catalogProgress.percent}%)
          </p>
        ) : null
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
            // Push a new history entry so back button can close the modal
            window.history.pushState({ modalOpen: true }, '')
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
          onClose={closeModal}
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