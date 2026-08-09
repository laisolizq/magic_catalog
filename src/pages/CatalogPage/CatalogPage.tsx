import { useEffect, useMemo, useRef, useState } from 'react'

import { List } from './components/List/List'
import { SearchBar } from './components/SearchBar/SearchBar'
import { CardModal } from './components/CardModal/CardModal'
import { mockCards } from '../../data/mockCards'
import type { Card } from '../../types/card'
import { filterCards, getUniqueSets, getUniqueTypes } from '../../utils/cardFilters'
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
  const [expandedOracles, setExpandedOracles] = useState<Record<string, boolean>>({})
  const sentinelRef = useRef<HTMLDivElement>(null)

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

  // Reset visible window whenever filters change
  useEffect(() => {
    setVisibleCount(BATCH_SIZE)
  }, [query, setValue, typeValue, rarityValue, colorValue])

  // Load next batch when the sentinel scrolls into view
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, filteredCards.length))
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

  return (
    <section className="catalog-page" aria-label="Catalog Page">
      <SearchBar
        query={query}
        setValue={setValue}
        typeValue={typeValue}
        rarityValue={rarityValue}
        colorValue={colorValue}
        setOptions={setOptions}
        typeOptions={typeOptions}
        onQueryChange={(value) => setQuery(value)}
        onSetChange={(value) => setSetValue(value)}
        onTypeChange={(value) => setTypeValue(value)}
        onRarityChange={(value) => setRarityValue(value)}
        onColorChange={(value) => setColorValue(value)}
      />

      {/* <p className="results-line">
        Card information: {filteredCards.length} match
        {filteredCards.length === 1 ? '' : 'es'}
      </p> */}

      <List
        cards={visibleCards}
        expandedOracles={expandedOracles}
        onToggleOracle={(cardId) =>
          setExpandedOracles((prev) => ({ ...prev, [cardId]: !prev[cardId] }))
        }
        onOpenDetails={(card) => setSelectedCard(card)}
      />

      {/* Sentinel: entering viewport triggers the next batch load */}
      <div ref={sentinelRef} aria-hidden="true" />

      {selectedCard && (
        <CardModal card={selectedCard} onClose={() => setSelectedCard(null)} />
      )}
    </section>
  )
}
