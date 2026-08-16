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
} from '../../utils/cardFilters'
import { SCROLL_SENSITIVITY } from '../../config/ui'
import './CatalogPage.css'

const BATCH_SIZE = 12

type SortOption =
  | 'default'
  | 'name-asc'
  | 'name-desc'
  | 'cmc-asc'
  | 'cmc-desc'
  | 'set-asc'
  | 'set-desc'

function getFaceName(card: Card): string {
  return card.faces[0]?.name ?? ''
}

function manaValueFromCost(cost: string): number {
  if (!cost) return 0

  const symbols = Array.from(cost.matchAll(/\{([^}]+)\}/g), (m) => m[1])

  return symbols.reduce((total, symbol) => {
    if (/^\d+$/.test(symbol)) return total + Number(symbol)
    if (symbol === 'X' || symbol === 'Y' || symbol === 'Z') return total
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

function sortCards(cards: Card[], sortOption: SortOption): Card[] {
  if (sortOption === 'default') return cards

  const sorted = [...cards]

  sorted.sort((left, right) => {
    switch (sortOption) {
      case 'name-asc':
        return getFaceName(left).localeCompare(getFaceName(right))
      case 'name-desc':
        return getFaceName(right).localeCompare(getFaceName(left))
      case 'cmc-asc': {
        const delta = manaValueFromCost(left.faces[0]?.manaCost ?? '') - manaValueFromCost(right.faces[0]?.manaCost ?? '')
        if (delta !== 0) return delta
        return getFaceName(left).localeCompare(getFaceName(right))
      }
      case 'cmc-desc': {
        const delta = manaValueFromCost(right.faces[0]?.manaCost ?? '') - manaValueFromCost(left.faces[0]?.manaCost ?? '')
        if (delta !== 0) return delta
        return getFaceName(left).localeCompare(getFaceName(right))
      }
      case 'set-asc': {
        const delta = left.set.localeCompare(right.set)
        if (delta !== 0) return delta
        return getFaceName(left).localeCompare(getFaceName(right))
      }
      case 'set-desc': {
        const delta = right.set.localeCompare(left.set)
        if (delta !== 0) return delta
        return getFaceName(left).localeCompare(getFaceName(right))
      }
      default:
        return 0
    }
  })

  return sorted
}

/**
 * Converts the new Scryfall structure:
 *
 * {
 *   id,
 *   rarity,
 *   set,
 *   faces: [...]
 * }
 *
 * into the structure currently expected by the UI.
 *
 * For now we display the first face of every card.
 * The complete `faces` array is kept in the original card
 * so we can later implement face switching.
 */
function getDisplayCards(): Card[] {
  // mockCards already uses the new shape expected by the app
  return mockCards
}

export function CatalogPage() {
  const [query, setQuery] = useState('')
  const [setValue, setSetValue] = useState('all')
  const [typeValue, setTypeValue] = useState('')
  const [rarityValue, setRarityValue] = useState('')
  const [colorValue, setColorValue] = useState('')
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE)
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [selectedFaceIndex, setSelectedFaceIndex] = useState<number>(0)

  const [expandedOracles, setExpandedOracles] = useState<
    Record<string, boolean>
  >({})

  const [expandAllCards, setExpandAllCards] = useState(false)

  const [isSearchVisible, setIsSearchVisible] = useState(true)
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [sortOption, setSortOption] = useState<SortOption>('default')

  const sentinelRef = useRef<HTMLDivElement>(null)
  const lastScrollY = useRef(0)
  const ignoreScrollRef = useRef(false)

  /*
   * Convert the new mockCards structure into the structure
   * currently used by the catalog UI.
   */
  const displayCards = useMemo(
    () => getDisplayCards(),
    [],
  )

  const filteredCards = useMemo(
    () =>
      filterCards(displayCards, {
        query,
        set: setValue,
        type: typeValue || 'all',
        rarity: rarityValue || 'all',
        color: colorValue || 'all',
      }),
    [
      displayCards,
      query,
      setValue,
      typeValue,
      rarityValue,
      colorValue,
    ],
  )

  const sortedFilteredCards = useMemo(
    () => sortCards(filteredCards, sortOption),
    [filteredCards, sortOption],
  )

  // Show/hide search bar depending on scroll direction
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY

      if (ignoreScrollRef.current) {
        lastScrollY.current = currentScrollY
        return
      }

      // small movements are ignored; we only react when the user scrolls
      // more than SCROLL_SENSITIVITY pixels in one direction.
      const delta = currentScrollY - lastScrollY.current

      if (currentScrollY <= 0) {
        setIsSearchVisible(true)
        lastScrollY.current = currentScrollY
        return
      }

      if (delta < -SCROLL_SENSITIVITY) {
        // scrolled up sufficiently
        setIsSearchVisible(true)
        lastScrollY.current = currentScrollY
      } else if (delta > SCROLL_SENSITIVITY) {
        // scrolled down sufficiently
        setIsSearchVisible(false)
        lastScrollY.current = currentScrollY
      }
      // otherwise, ignore small deltas and don't update lastScrollY to allow
      // accumulation of small movements into a larger one.
    }

    window.addEventListener('scroll', handleScroll, {
      passive: true,
    })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  // Load more cards when the sentinel enters the viewport
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
   * IMPORTANT:
   * Use displayCards here, not mockCards, because the filters
   * currently operate on the old Card structure.
   */
  const setOptions = useMemo(
    () => getUniqueSets(displayCards),
    [displayCards],
  )

  const typeOptions = useMemo(
    () => getUniqueTypes(displayCards),
    [displayCards],
  )

  const visibleCardsSorted = sortedFilteredCards.slice(0, visibleCount)
  const expandedOraclesView = expandAllCards
    ? Object.fromEntries(sortedFilteredCards.map((card) => [card.id, true]))
    : expandedOracles

  const modalCards = sortedFilteredCards

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

  const scrollToCard = (cardId?: string, faceIndex?: number) => {
    if (!cardId) return
    let selector = `[data-card-id="${cardId}"]`
    if (typeof faceIndex === 'number') selector += `[data-face-index="${faceIndex}"]`
    const el = document.querySelector(selector) as HTMLElement | null
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  const handleExpandAllChange = (checked: boolean) => {
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

  const handleSortChange = (value: SortOption) => {
    setSortOption(value)
    setVisibleCount(BATCH_SIZE)
  }

  const handleFilterStateChange = (
    callback: () => void,
  ) => {
    callback()
    setVisibleCount(BATCH_SIZE)
    if (!expandAllCards) {
      setExpandedOracles({})
    }
  }

  const handleBasicFilterChange = (
    callback: () => void,
  ) => {
    handleFilterStateChange(callback)
    if (isAdvancedOpen) {
      handleAdvancedOpenChange(false)
    }
  }

  const handleAdvancedOpenChange = (value: boolean) => {
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
          isSearchVisible
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
          sortOption={sortOption}
          setOptions={setOptions}
          typeOptions={typeOptions}
          isAdvancedOpen={isAdvancedOpen}
          expandAllCards={expandAllCards}
          onAdvancedOpenChange={
            handleAdvancedOpenChange
          }
          onExpandAllChange={
            handleExpandAllChange
          }
          onSortChange={handleSortChange}
          onQueryChange={(value) =>
            handleFilterStateChange(() => setQuery(value))
          }
          onSetChange={(value) =>
            handleBasicFilterChange(() => setSetValue(value))
          }
          onTypeChange={(value) =>
            handleBasicFilterChange(() => setTypeValue(value))
          }
          onRarityChange={(value) =>
            handleBasicFilterChange(() => setRarityValue(value))
          }
          onColorChange={(value) =>
            handleBasicFilterChange(() => setColorValue(value))
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
        }
        }
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
          }
          }
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