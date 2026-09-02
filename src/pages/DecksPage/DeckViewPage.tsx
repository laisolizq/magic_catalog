import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { AdvancedCatalogChrome } from '../CatalogPage/components/CatalogChrome/AdvancedCatalogChrome'
import { BasicCatalogChrome } from '../CatalogPage/components/CatalogChrome/BasicCatalogChrome'
import { CardModal } from '../CatalogPage/components/CardModal/CardModal'
import { List } from '../CatalogPage/components/List/List'
import { resolveDefaultSort } from '../CatalogPage/CatalogPage'
import { SearchBar } from '../CatalogPage/components/SearchBar/SearchBar'
import { getCatalogSetOptions, getCatalogTypes, queryCards } from '../../services/sqliteCardQuery'
import { getDeck } from '../../services/deckService'
import type { Card } from '../../types/card'
import type { Deck } from '../../types/deck'
import type { SetOption } from '../../types/catalog'
import { buildScryfallQuery, parseScryfallQuery, type ColorFilterMode } from '../../utils/scryfallQuery'
import './DeckViewPage.css'

type SortOption = 'default' | 'set-asc' | 'set-desc' | 'name-asc' | 'name-desc' | 'cmc-asc' | 'cmc-desc' | 'added-asc' | 'added-desc'

const typeFilters = ['artifact', 'battle', 'creature', 'enchantment', 'instant', 'land', 'planeswalker', 'sorcery']

function cardName(card: Card) { return card.faces[0]?.name ?? '' }

function sortCards(cards: Card[], option: SortOption) {
  return [...cards].sort((left, right) => {
    const nameOrder = cardName(left).localeCompare(cardName(right))
    if (option === 'name-desc') return -nameOrder
    if (option === 'set-desc') return right.set.localeCompare(left.set) || nameOrder
    if (option === 'set-asc') return left.set.localeCompare(right.set) || nameOrder
    if (option === 'added-desc') return (right.addedAt ?? '').localeCompare(left.addedAt ?? '') || nameOrder
    if (option === 'added-asc') return (left.addedAt ?? '').localeCompare(right.addedAt ?? '') || nameOrder
    return nameOrder
  })
}

export function DeckViewPage() {
  const { deckId } = useParams()
  const navigate = useNavigate()
  const [deck, setDeck] = useState<Deck | null>(null)
  const [query, setQuery] = useState('')
  const [cards, setCards] = useState<Card[]>([])
  const [typeOptions, setTypeOptions] = useState<string[]>(typeFilters)
  const [setOptions, setSetOptions] = useState<SetOption[]>([])
  const [sortOption, setSortOption] = useState<SortOption>('name-asc')
  const [showAllPrints, setShowAllPrints] = useState(true)
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [expandAllCards, setExpandAllCards] = useState(false)
  const [expandedOracles, setExpandedOracles] = useState<Record<string, boolean>>({})
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [selectedFaceIndex, setSelectedFaceIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const parsedQuery = useMemo(() => parseScryfallQuery(query), [query])

  useEffect(() => {
    if (!deckId) return
    void getDeck(deckId).then((value) => setDeck(value ?? null)).catch(() => setError('Unable to load this deck.'))
  }, [deckId])

  useEffect(() => {
    void Promise.all([getCatalogTypes(), getCatalogSetOptions()]).then(([types, sets]) => {
      const supported = new Set(types.map((type) => type.toLowerCase()))
      setTypeOptions(typeFilters.filter((type) => supported.has(type)))
      setSetOptions(sets)
    }).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!deck) return
    let cancelled = false
    void queryCards({
      text: parsedQuery.text,
      oracle: parsedQuery.oracle,
      sets: parsedQuery.sets,
      types: parsedQuery.types.map((type) => type.toLowerCase()),
      rarities: parsedQuery.rarities,
      legality: parsedQuery.legality,
      colors: parsedQuery.colors,
      colorMode: parsedQuery.colorMode,
      colorCount: parsedQuery.colorCount,
      cardIds: deck.cards.map((entry) => entry.cardId),
    }).then((result) => {
      if (!cancelled) setCards(result.cards)
    }).catch(() => {
      if (!cancelled) setError('Unable to load cards for this deck.')
    }).finally(() => {
      if (!cancelled) setIsLoading(false)
    })
    return () => { cancelled = true }
  }, [deck, parsedQuery])

  const effectiveSortOption = sortOption === 'default'
    ? resolveDefaultSort(parsedQuery, setOptions)
    : sortOption
  const displayedCards = useMemo(() => sortCards(cards, effectiveSortOption), [cards, effectiveSortOption])
  const quantities = useMemo(() => Object.fromEntries(deck?.cards.map((entry) => [entry.cardId, entry.quantity]) ?? []), [deck])
  const selectedIndex = selectedCard ? displayedCards.findIndex((card) => card.id === selectedCard.id) : -1
  const filters = {
    text: parsedQuery.text,
    oracle: parsedQuery.oracle,
    colors: parsedQuery.colors,
    colorMode: parsedQuery.colorMode,
    colorCount: parsedQuery.colorCount,
    types: parsedQuery.types,
    rarities: parsedQuery.rarities,
    legality: parsedQuery.legality,
    sets: parsedQuery.sets,
  }
  const updateFilters = (changes: Partial<typeof filters>) => setQuery(buildScryfallQuery({ ...filters, ...changes }))

  if (!deck && !error) return <p className="deck-page-status" role="status">Loading deck...</p>
  if (!deck) return <p className="deck-page-status" role="alert">{error}</p>

  const searchBar = <SearchBar
    query={query}
    typeValue={parsedQuery.types.map((type) => type.toLowerCase())}
    rarityValue={parsedQuery.rarities}
    legalityValue={parsedQuery.legality}
    colorValue={parsedQuery.colors}
    colorMode={parsedQuery.colorMode}
    oracleValue={parsedQuery.oracle}
    sortOption={sortOption}
    typeOptions={typeOptions}
    setValue={parsedQuery.sets}
    setOptions={setOptions}
    isAdvancedOpen={isAdvancedOpen}
    expandAllCards={expandAllCards}
    showAllPrints={showAllPrints}
    onAdvancedOpenChange={setIsAdvancedOpen}
    onExpandAllChange={setExpandAllCards}
    onSortChange={setSortOption}
    onQueryChange={setQuery}
    onTypeChange={(value) => updateFilters({ types: value })}
    onRarityChange={(value) => updateFilters({ rarities: value })}
    onLegalityChange={(value) => updateFilters({ legality: value })}
    onColorChange={(value) => updateFilters({ colors: value })}
    onColorModeChange={(value: ColorFilterMode) => updateFilters({ colorMode: value })}
    onOracleChange={(value) => updateFilters({ oracle: value })}
    onSetsChange={(value) => updateFilters({ sets: value })}
    onShowAllPrintsChange={setShowAllPrints}
  />

  return <section className="deck-view-page">
    {isAdvancedOpen ? <AdvancedCatalogChrome><div className="search-bar-wrapper">{searchBar}</div></AdvancedCatalogChrome> : <BasicCatalogChrome><div className="search-bar-wrapper">{searchBar}</div></BasicCatalogChrome>}
    <header className="deck-view-header">
      <Link to="/decks">← Decks</Link>
      <h1>{deck.name}</h1>
      <span>{deck.cards.length} unique cards</span>
    </header>
    {deck.unresolvedLines.length > 0 && <aside className="deck-warning" role="status"><strong>Unresolved decklist lines</strong><ul>{deck.unresolvedLines.map((line) => <li key={line.rawLine}>{line.rawLine}: {line.reason}</li>)}</ul></aside>}
    {error && <p role="alert">{error}</p>}
    {isLoading ? <p role="status">Loading cards...</p> : <List cards={displayedCards} expandedOracles={expandAllCards ? Object.fromEntries(displayedCards.map((card) => [card.id, true])) : expandedOracles} quantities={quantities} onToggleOracle={(cardId) => setExpandedOracles((current) => ({ ...current, [cardId]: !current[cardId] }))} onOpenDetails={(card, faceIndex = 0) => { setSelectedCard(card); setSelectedFaceIndex(faceIndex) }} />}
    {selectedCard && <CardModal card={selectedCard} initialFaceIndex={selectedFaceIndex} onClose={() => setSelectedCard(null)} onShowPrevious={() => { if (selectedIndex > 0) setSelectedCard(displayedCards[selectedIndex - 1]) }} onShowNext={() => { if (selectedIndex >= 0 && selectedIndex < displayedCards.length - 1) setSelectedCard(displayedCards[selectedIndex + 1]) }} hasPrevious={selectedIndex > 0} hasNext={selectedIndex >= 0 && selectedIndex < displayedCards.length - 1} previousCard={selectedIndex > 0 ? displayedCards[selectedIndex - 1] : null} nextCard={selectedIndex >= 0 ? displayedCards[selectedIndex + 1] ?? null : null} />}
    <button type="button" className="deck-back-button" onClick={() => navigate('/decks')}>Back to decks</button>
  </section>
}