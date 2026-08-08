import { useMemo, useState } from 'react'

import { List } from '../../components/List/List'
import { Pagination } from '../../components/Pagination/Pagination'
import { SearchBar } from '../../components/SearchBar/SearchBar'
import { mockCards } from '../../data/mockCards'
import type { Card } from '../../types/card'
import { filterCards, getUniqueSets, getUniqueTypes } from '../../utils/cardFilters'

const PAGE_SIZE = 6

export function CatalogPage() {
  const [query, setQuery] = useState('')
  const [setValue, setSetValue] = useState('all')
  const [typeValue, setTypeValue] = useState('all')
  const [rarityValue, setRarityValue] = useState('all')
  const [colorValue, setColorValue] = useState('all')
  const [page, setPage] = useState(1)
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [expandedOracles, setExpandedOracles] = useState<Record<string, boolean>>({})

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

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const currentSlice = filteredCards.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  )

  const setOptions = useMemo(() => getUniqueSets(mockCards), [])
  const typeOptions = useMemo(() => getUniqueTypes(mockCards), [])

  const updatePageOnFilter = (updater: () => void) => {
    updater()
    setPage(1)
  }

  return (
    <section className="catalog-page" aria-label="Catalog Page">
      <div className="catalog-hero">
        <p className="mini-kicker">set:tla cn≥1 cn≤286</p>
        <h1>i</h1>
        <p className="hero-subtitle">Main purpose: review limited set cards</p>
      </div>

      <SearchBar
        query={query}
        setValue={setValue}
        typeValue={typeValue}
        rarityValue={rarityValue}
        colorValue={colorValue}
        setOptions={setOptions}
        typeOptions={typeOptions}
        onQueryChange={(value) => updatePageOnFilter(() => setQuery(value))}
        onSetChange={(value) => updatePageOnFilter(() => setSetValue(value))}
        onTypeChange={(value) => updatePageOnFilter(() => setTypeValue(value))}
        onRarityChange={(value) =>
          updatePageOnFilter(() => setRarityValue(value))
        }
        onColorChange={(value) => updatePageOnFilter(() => setColorValue(value))}
      />

      <p className="results-line">
        Card information: {filteredCards.length} match
        {filteredCards.length === 1 ? '' : 'es'}
      </p>

      <List
        cards={currentSlice}
        expandedOracles={expandedOracles}
        onToggleOracle={(cardId) =>
          setExpandedOracles((prev) => ({ ...prev, [cardId]: !prev[cardId] }))
        }
        onOpenDetails={(card) => setSelectedCard(card)}
      />

      <Pagination
        currentPage={safePage}
        totalPages={totalPages}
        onPageChange={(nextPage) => {
          if (nextPage >= 1 && nextPage <= totalPages) {
            setPage(nextPage)
          }
        }}
      />

      {selectedCard && (
        <div
          className="card-modal-overlay"
          role="presentation"
          onClick={() => setSelectedCard(null)}
        >
          <aside
            className="card-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedCard.name} details`}
            onClick={(event) => event.stopPropagation()}
          >
            <h2>{selectedCard.name}</h2>
            <p>{selectedCard.typeLine}</p>
            <p>
              {selectedCard.power ?? '-'} / {selectedCard.toughness ?? '-'}
            </p>
            <p>{selectedCard.oracleText}</p>
            <p>
              set {selectedCard.set} | rarity {selectedCard.rarity} | color{' '}
              {selectedCard.colors.join('')}
            </p>
            <button type="button" onClick={() => setSelectedCard(null)}>
              Close
            </button>
          </aside>
        </div>
      )}
    </section>
  )
}
