import { useEffect, useMemo, useRef, useState } from 'react'

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
import './CatalogPage.css'

const BATCH_SIZE = 12

export function CatalogPage() {
  const [query, setQuery] = useState('')
  const [setValue, setSetValue] = useState('all')
  const [typeValue, setTypeValue] = useState('all')
  const [rarityValue, setRarityValue] = useState('all')
  const [colorValue, setColorValue] = useState('all')
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE)
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)

  const [expandedOracles, setExpandedOracles] = useState<
    Record<string, boolean>
  >({})

  const [expandAllCards, setExpandAllCards] = useState(false)

  const [isSearchVisible, setIsSearchVisible] = useState(true)
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)

  const sentinelRef = useRef<HTMLDivElement>(null)
  const lastScrollY = useRef(0)
  const ignoreScrollRef = useRef(false)

  const filteredCards = useMemo(
    () =>
      filterCards(mockCards, {
        query,
        set: setValue,
        type: typeValue,
        rarity: rarityValue,
        color: colorValue,
      }),
    [query, setValue, typeValue, rarityValue, colorValue],
  )

  // Reset visible cards and expanded state whenever filters change
  useEffect(() => {
    setVisibleCount(BATCH_SIZE)

    if (expandAllCards) {
      const expanded: Record<string, boolean> = {}

      filteredCards.forEach((card) => {
        expanded[card.id] = true
      })

      setExpandedOracles(expanded)
    } else {
      setExpandedOracles({})
    }
  }, [
    query,
    setValue,
    typeValue,
    rarityValue,
    colorValue,
    filteredCards,
    expandAllCards,
  ])

  // Show/hide search bar depending on scroll direction
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY

      // Ignore scroll events caused by opening/closing the filters
      if (ignoreScrollRef.current) {
        lastScrollY.current = currentScrollY
        return
      }

      if (currentScrollY <= 0) {
        setIsSearchVisible(true)
      } else if (currentScrollY < lastScrollY.current) {
        // Scrolling up
        setIsSearchVisible(true)
      } else if (currentScrollY > lastScrollY.current) {
        // Scrolling down
        setIsSearchVisible(false)
      }

      lastScrollY.current = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

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
            Math.min(prev + BATCH_SIZE, filteredCards.length),
          )
        }
      },
      { rootMargin: '300px' },
    )

    observer.observe(sentinel)

    return () => observer.disconnect()
  }, [filteredCards.length])

  const setOptions = useMemo(() => getUniqueSets(mockCards), [])
  const typeOptions = useMemo(() => getUniqueTypes(mockCards), [])
  const visibleCards = filteredCards.slice(0, visibleCount)
  const modalCards = filteredCards
  const selectedCardIndex = selectedCard
    ? modalCards.findIndex((card) => card.id === selectedCard.id)
    : -1

  const showPreviousCard = () => {
    if (selectedCardIndex <= 0) return
    setSelectedCard(modalCards[selectedCardIndex - 1])
  }

  const showNextCard = () => {
    if (
      selectedCardIndex < 0 ||
      selectedCardIndex >= modalCards.length - 1
    ) {
      return
    }

    setSelectedCard(modalCards[selectedCardIndex + 1])
  }

  const handleExpandAllChange = (checked: boolean) => {
    const currentScrollY = window.scrollY

    // Ignore scroll events caused by cards changing their height
    ignoreScrollRef.current = true

    setExpandAllCards(checked)

    if (checked) {
      const expanded: Record<string, boolean> = {}

      filteredCards.forEach((card) => {
        expanded[card.id] = true
      })

      setExpandedOracles(expanded)
    } else {
      setExpandedOracles({})
    }

    // The search bar must remain visible
    setIsSearchVisible(true)

    /*
    * Expanding/collapsing all cards changes the page height.
    * Restore the scroll position after the layout has been recalculated.
    */
    requestAnimationFrame(() => {
      window.scrollTo({
        top: currentScrollY,
        behavior: 'instant',
      })

      lastScrollY.current = currentScrollY

      // Wait one more frame so layout changes are completely settled
      requestAnimationFrame(() => {
        ignoreScrollRef.current = false
        lastScrollY.current = window.scrollY
        setIsSearchVisible(true)
      })
    })
  }

  const handleAdvancedOpenChange = (value: boolean) => {
    const currentScrollY = window.scrollY

    // Ignore the scroll events generated by the layout change
    ignoreScrollRef.current = true

    setIsAdvancedOpen(value)
    setIsSearchVisible(true)

    requestAnimationFrame(() => {
      window.scrollTo({
        top: currentScrollY,
        behavior: 'instant',
      })

      lastScrollY.current = currentScrollY

      // Resume normal scroll handling after the layout has settled
      requestAnimationFrame(() => {
        ignoreScrollRef.current = false
        lastScrollY.current = window.scrollY
      })
    })
  }

  return (
    <section className="catalog-page" aria-label="Catalog Page">
      <div
        className={`search-bar-wrapper ${
          isSearchVisible ? 'search-visible' : 'search-hidden'
        }`}
      >
        <SearchBar
          query={query}
          setValue={setValue}
          typeValue={typeValue}
          rarityValue={rarityValue}
          colorValue={colorValue}
          setOptions={setOptions}
          typeOptions={typeOptions}
          isAdvancedOpen={isAdvancedOpen}
          expandAllCards={expandAllCards}
          onAdvancedOpenChange={handleAdvancedOpenChange}
          onExpandAllChange={handleExpandAllChange}
          onQueryChange={(value) => setQuery(value)}
          onSetChange={(value) => setSetValue(value)}
          onTypeChange={(value) => setTypeValue(value)}
          onRarityChange={(value) => setRarityValue(value)}
          onColorChange={(value) => setColorValue(value)}
        />
      </div>

      <List
        cards={visibleCards}
        expandedOracles={expandedOracles}
        onToggleOracle={(cardId) =>
          setExpandedOracles((prev) => ({
            ...prev,
            [cardId]: !prev[cardId],
          }))
        }
        onOpenDetails={(card) => setSelectedCard(card)}
      />

      <div ref={sentinelRef} aria-hidden="true" />

      {selectedCard && (
        <CardModal
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onShowPrevious={showPreviousCard}
          onShowNext={showNextCard}
          hasPrevious={selectedCardIndex > 0}
          hasNext={selectedCardIndex >= 0 && selectedCardIndex < modalCards.length - 1}
          previousCard={selectedCardIndex > 0 ? modalCards[selectedCardIndex - 1] : null}
          nextCard={
            selectedCardIndex >= 0 && selectedCardIndex < modalCards.length - 1
              ? modalCards[selectedCardIndex + 1]
              : null
          }
        />
      )}
    </section>
  )
}