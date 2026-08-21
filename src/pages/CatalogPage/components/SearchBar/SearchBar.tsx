import { useEffect, useRef, useState } from 'react'

import { AdvancedFilters } from './AdvancedFilters'
import { FilterSheet } from './FilterSheet'
import './SearchBar.css'

import { symbolUrl } from '../../../../utils/utils.ts'

type SortOption =
  | 'set-asc'
  | 'set-desc'
  | 'name-asc'
  | 'name-desc'
  | 'cmc-asc'
  | 'cmc-desc'

type SortCategory = 'set' | 'name' | 'cmc'
const SEARCH_DEBOUNCE_MS = 300

const SORT_CATEGORIES: Array<{ value: SortCategory; label: string }> = [
  { value: 'set', label: 'Set' },
  { value: 'name', label: 'Name' },
  { value: 'cmc', label: 'Mana Value' },
]

const COLOR_OPTIONS = [
  {
  value: 'W',
  label: (
    <>
      <img
          className="mana-symbol"
          src={symbolUrl('W')}
          alt="W"
          aria-hidden="true"
        /> <span className="filter-option-label">White</span>
    </>
  ),
  className: 'filter-color-w'
},
  { value: 'U', label: (
    <>
      <img
          className="mana-symbol"
          src={symbolUrl('U')}
          alt="U"
          aria-hidden="true"
        /> <span className="filter-option-label">Blue</span>
    </>
  ), className: 'filter-color-u' },
  { value: 'B', label: (
    <>
      <img
          className="mana-symbol"
          src={symbolUrl('B')}
          alt="B"
          aria-hidden="true"
        /> <span className="filter-option-label">Black</span>
    </>
  ), className: 'filter-color-b' },
  { value: 'R', label: (
    <>
      <img
          className="mana-symbol"
          src={symbolUrl('R')}
          alt="R"
          aria-hidden="true"
        /> <span className="filter-option-label">Red</span>
    </>
  ), className: 'filter-color-r' },
  { value: 'G', label: (
    <>
      <img
          className="mana-symbol"
          src={symbolUrl('G')}
          alt="G"
          aria-hidden="true"
        /> <span className="filter-option-label">Green</span>
    </>
  ), className: 'filter-color-g' },
  { value: 'C', label: (
    <>
      <img
          className="mana-symbol"
          src={symbolUrl('C')}
          alt="C"
          aria-hidden="true"
        /> <span className="filter-option-label">Colorless</span>
    </>
  ), className: 'filter-color-c' },
  { value: 'M', label: (
    <>
      <img
          className="mana-symbol"
          src={symbolUrl('M')}
          alt="M"
          aria-hidden="true"
        /> <span className="filter-option-label">Multicolor</span>
    </>
  ), className: 'filter-color-m' },
]

const RARITY_OPTIONS = [
  { value: 'common', label: 'Common', className: 'filter-rarity-common' },
  { value: 'uncommon', label: 'Uncommon', className: 'filter-rarity-uncommon' },
  { value: 'rare', label: 'Rare', className: 'filter-rarity-rare' },
  { value: 'mythic', label: 'Mythic', className: 'filter-rarity-mythic' },
]

interface SearchBarProps {
  query: string
  typeValue: string[]
  rarityValue: string[]
  colorValue: string[]
  sortOption: SortOption
  typeOptions: string[]
  isAdvancedOpen: boolean
  expandAllCards: boolean
  showAllPrints: boolean

  onAdvancedOpenChange: (value: boolean) => void
  onExpandAllChange: (value: boolean) => void
  onSortChange: (value: SortOption) => void
  onQueryChange: (value: string) => void

  onTypeChange: (value: string[]) => void
  onRarityChange: (value: string[]) => void
  onColorChange: (value: string[]) => void
  onShowAllPrintsChange: (value: boolean) => void
}

export function SearchBar({
  query,
  typeValue,
  rarityValue,
  colorValue,
  sortOption,
  typeOptions,
  isAdvancedOpen,
  expandAllCards,
  showAllPrints,
  onAdvancedOpenChange,
  onExpandAllChange,
  onSortChange,
  onQueryChange,
  onTypeChange,
  onRarityChange,
  onColorChange,
  onShowAllPrintsChange,
}: SearchBarProps) {
  const [isSortOpen, setIsSortOpen] = useState(false)
  const [isColorOpen, setIsColorOpen] = useState(false)
  const [isTypeOpen, setIsTypeOpen] = useState(false)
  const [isRarityOpen, setIsRarityOpen] = useState(false)
  const [searchValue, setSearchValue] = useState(query)

  const sortControlRef = useRef<HTMLDivElement>(null)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isEditingSearchRef = useRef(false)

  useEffect(() => {
    if (isEditingSearchRef.current) return
    if (query === searchValue) return

    const timer = window.setTimeout(() => {
      setSearchValue(query)
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [query, searchValue])

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
  }, [])

  // Closes the sort menu when the user clicks/taps anywhere outside of it.
  useEffect(() => {
    if (!isSortOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!sortControlRef.current?.contains(event.target as Node)) {
        setIsSortOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () =>
      document.removeEventListener('pointerdown', handlePointerDown)
  }, [isSortOpen])

  const searchInputRef = useRef<HTMLInputElement>(null)

  // Skips the focus-triggered space padding right after a clear, since the
  // focus handler would otherwise see the stale (pre-clear) `query` closure
  // and re-add it.
  const skipNextFocusAdjustRef = useRef(false)

  /*
   * Puts the caret at the end of the query and, if it doesn't already end
   * with a space, adds one first. That way typing right after focusing
   * starts a new free-text word instead of gluing onto the last token
   * (e.g. "s:hob" + typed "dragon" becoming "s:hobdragon").
   */
  const handleSearchFocus = () => {
    isEditingSearchRef.current = true

    if (skipNextFocusAdjustRef.current) {
      skipNextFocusAdjustRef.current = false
      return
    }

    const input = searchInputRef.current
    const nextQuery =
      searchValue.length > 0 && !searchValue.endsWith(' ')
        ? `${searchValue} `
        : searchValue

    if (nextQuery !== searchValue) {
      setSearchValue(nextQuery)
    }

    requestAnimationFrame(() => {
      input?.setSelectionRange(nextQuery.length, nextQuery.length)
    })
  }

  const handleSearchBlur = () => {
    isEditingSearchRef.current = false

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current)
      searchDebounceRef.current = null
      onQueryChange(searchValue)
    }
  }

  /*
   * Clears the query so the user can start typing a fresh search
   * right away.
   */
  const handleClearSearch = () => {
    skipNextFocusAdjustRef.current = true
    isEditingSearchRef.current = true
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)

    setSearchValue('')

    searchDebounceRef.current = setTimeout(() => {
      onQueryChange('')
      searchDebounceRef.current = null
    }, SEARCH_DEBOUNCE_MS)

    searchInputRef.current?.focus()
  }

  const handleSearchChange = (value: string) => {
    setSearchValue(value)

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      onQueryChange(value)
      searchDebounceRef.current = null
    }, SEARCH_DEBOUNCE_MS)
  }

  const handleSortSelect = (category: SortCategory) => {
    const [activeCategory, activeDirection] = sortOption.split('-') as [
      SortCategory,
      'asc' | 'desc',
    ]

    const nextDirection =
      category === activeCategory && activeDirection === 'asc'
        ? 'desc'
        : 'asc'

    onSortChange(`${category}-${nextDirection}` as SortOption)
    setIsSortOpen(false)
  }

  const handleColorSelect = (value: string) => {
    handleBasicFilterChange(value, onColorChange)
    setIsColorOpen(false)
  }

  const handleTypeSelect = (value: string) => {
    handleBasicFilterChange(value, onTypeChange)
    setIsTypeOpen(false)
  }

  const handleRaritySelect = (value: string) => {
    handleBasicFilterChange(value, onRarityChange)
    setIsRarityOpen(false)
  }

  const handleOracleToggle = () => {
    onExpandAllChange(!expandAllCards)

    if (isAdvancedOpen) {
      onAdvancedOpenChange(false)
    }
  }

  /*
   * The basic filters only allow one value.
   * The advanced filters allow multiple values.
   *
   * When a basic filter is changed, we replace the current
   * selection with the selected value.
   */
  const handleBasicFilterChange = (
    value: string,
    onChange: (value: string[]) => void,
  ) => {
    if (!value || value === 'all') {
      onChange([])
      return
    }

    onChange([value])
  }

  /*
   * If the advanced filters are open, show that view instead
   * of the normal search bar.
   */
  if (isAdvancedOpen) {
    return (
      <AdvancedFilters
        colorValue={colorValue}
        typeValue={typeValue}
        rarityValue={rarityValue}
        typeOptions={typeOptions}
        showAllPrints={showAllPrints}
        onColorChange={onColorChange}
        onTypeChange={onTypeChange}
        onRarityChange={onRarityChange}
        onShowAllPrintsChange={onShowAllPrintsChange}
        onClose={() => onAdvancedOpenChange(false)}
      />
    )
  }

  return (
    <section className="search-panel" aria-label="Card search">
      <div className="search-actions-row">
        <div className="search-input-wrap">
          <span className="search-input-icon" aria-hidden="true">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M10 2a8 8 0 1 0 5.29 14.01l4.35 4.34 1.41-1.41-4.34-4.35A8 8 0 0 0 10 2zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12z" />
            </svg>
          </span>

          <input
            id="card-search-input"
            ref={searchInputRef}
            className="search-input"
            aria-label="Search cards"
            placeholder="Search cards or filters..."
            value={searchValue}
            onChange={(event) => handleSearchChange(event.target.value)}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
          />

          {searchValue.length > 0 && (
            <button
              type="button"
              className="search-input-clear"
              aria-label="Clear search"
              title="Clear search"
              onMouseDown={(event) => {
                // Prevent input blur so we do not flush a pending query before clearing.
                event.preventDefault()
              }}
              onClick={handleClearSearch}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4l5.6 5.6 1.4-1.4-5.6-5.6L19 6.4 17.6 5 12 10.6 6.4 5Z" />
              </svg>
            </button>
          )}
        </div>

        <button
          type="button"
          className={`oracle-eye-toggle ${
            expandAllCards ? 'is-active' : ''
          }`}
          aria-label="Expand oracles"
          aria-pressed={expandAllCards}
          onClick={handleOracleToggle}
          title="Expand oracles"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {expandAllCards ? (
              <>
                {/* Top-right: points inward ↙ */}
                <path d="M20 4l-6 6" />
                <path d="M14 10h5" />
                <path d="M14 10v-5" />

                {/* Bottom-left: points inward ↗ */}
                <path d="M4 20l6-6" />
                <path d="M10 14H5" />
                <path d="M10 14v5" />
              </>
            ) : (
              <>
                {/* Top-right: points outward ↗ */}
                <path d="M14 10l6-6" />
                <path d="M20 4h-5" />
                <path d="M20 4v5" />

                {/* Bottom-left: points outward ↙ */}
                <path d="M10 14l-6 6" />
                <path d="M4 20h5" />
                <path d="M4 20v-5" />
              </>
            )}
          </svg>
        </button>

        <div className="sort-control" ref={sortControlRef}>
          <button
            type="button"
            className="sort-toggle"
            aria-haspopup="menu"
            aria-expanded={isSortOpen}
            aria-label="Sort cards"
            onClick={() => setIsSortOpen((value) => !value)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M3 18h6v-2H3v2zm0-5h12v-2H3v2zm0-7v2h18V6H3z" />
            </svg>
          </button>

          {isSortOpen && (
            <div
              className="sort-menu"
              role="menu"
              aria-label="Sort options"
            >
              {SORT_CATEGORIES.map(({ value, label }) => {
                const [activeCategory, activeDirection] =
                  sortOption.split('-') as [SortCategory, 'asc' | 'desc']

                const isActive = activeCategory === value

                return (
                  <button
                    key={value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isActive}
                    onClick={() => handleSortSelect(value)}
                  >
                    <span className="sort-menu-label">{label}</span>
                    {isActive && ' '}
                    {isActive && (
                      <span className="sort-menu-arrows">
                        <span
                          className={
                            activeDirection === 'asc' ? 'is-active' : ''
                          }
                        >
                          ↑
                        </span>
                        /
                        <span
                          className={
                            activeDirection === 'desc' ? 'is-active' : ''
                          }
                        >
                          ↓
                        </span>
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="basic-filters-row">
        <div className="basic-filter">
          <button
            type="button"
            className={`filter-color-toggle ${
              colorValue.length === 1
                ? `filter-color-${colorValue[0].toLowerCase()}`
                : ''
            }`}
            aria-haspopup="dialog"
            aria-expanded={isColorOpen}
            aria-label="color"
            onClick={() => setIsColorOpen(true)}
          >
            {colorValue.length === 1
              ? COLOR_OPTIONS.find((option) => option.value === colorValue[0])
                  ?.label
              : colorValue.includes('all')
                ? 'All colors'
                : 'Color'}
          </button>

          {isColorOpen && (
            <FilterSheet
              title="Select color"
              options={[
                { value: '', label: 'All colors' },
                ...COLOR_OPTIONS,
              ]}
              selectedValues={colorValue}
              onSelect={(value) => {
                handleColorSelect(value)
                setIsColorOpen(false)
              }}
              onClose={() => setIsColorOpen(false)}
            />
          )}
        </div>

        <div className="basic-filter">
          <button
            type="button"
            className="filter-type-toggle"
            aria-haspopup="dialog"
            aria-expanded={isTypeOpen}
            aria-label="type"
            onClick={() => setIsTypeOpen(true)}
          >
            {typeValue.length === 1
              ? (
                  <img
                    className="type-symbol"
                    src={symbolUrl(typeValue[0])}
                    alt={typeValue[0]}
                    aria-hidden="true"
                  />
                )
              : typeValue.includes('all')
                ? 'All types'
                : 'Type'}
          </button>

          {isTypeOpen && (
            <FilterSheet
              title="Select type"
              options={[
                { value: '', label: 'All types' },
                ...typeOptions.map((typeOption) => ({
                  value: typeOption,
                  label: (
                    <>
                      <img
                        className="type-symbol"
                        src={symbolUrl(typeOption)}
                        alt={typeOption}
                        aria-hidden="true"
                      />{' '}
                      {typeOption}
                    </>
                  ),
                })),
              ]}
              selectedValues={typeValue}
              onSelect={(value) => {
                handleTypeSelect(value)
                setIsTypeOpen(false)
              }}
              onClose={() => setIsTypeOpen(false)}
            />
          )}
        </div>

        <div className="basic-filter">
          <button
            type="button"
            className={`filter-rarity-toggle ${
              rarityValue.length === 1
                ? `filter-rarity-${rarityValue[0].toLowerCase()}`
                : ''
            }`}
            aria-haspopup="dialog"
            aria-expanded={isRarityOpen}
            aria-label="rarity"
            onClick={() => setIsRarityOpen(true)}
          >
            {rarityValue.length === 1
              ? RARITY_OPTIONS.find(
                  (option) => option.value === rarityValue[0],
                )?.label
              : rarityValue.includes('all')
                ? 'All rarities'
                : 'Rarity'}
          </button>

          {isRarityOpen && (
            <FilterSheet
              title="Select rarity"
              options={[
                { value: '', label: 'All rarities' },
                ...RARITY_OPTIONS,
              ]}
              selectedValues={rarityValue}
              onSelect={(value) => {
                handleRaritySelect(value)
                setIsRarityOpen(false)
              }}
              onClose={() => setIsRarityOpen(false)}
            />
          )}
        </div>

        <button
          type="button"
          className="advanced-toggle"
          aria-label="Show advanced filters"
          aria-expanded={false}
          aria-controls="advanced-filters"
          onClick={() => onAdvancedOpenChange(true)}
        >
          +
        </button>
      </div>
    </section>
  )
}