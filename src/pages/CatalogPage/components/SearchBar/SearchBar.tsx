import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { AdvancedFilters } from './AdvancedFilters'
import { FilterSheet, type FilterSheetOption } from './FilterSheet'
import './SearchBar.css'

import {
  type ColorFilterMode,
} from '../../../../utils/scryfallQuery'
import { symbolUrl } from '../../../../utils/utils.ts'
import type { SetOption } from '../../../../types/catalog'

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
        />{' '}
        <span className="filter-option-label">
          White
        </span>
      </>
    ),
    className: 'filter-color-w',
  },
  {
    value: 'U',
    label: (
      <>
        <img
          className="mana-symbol"
          src={symbolUrl('U')}
          alt="U"
          aria-hidden="true"
        />{' '}
        <span className="filter-option-label">
          Blue
        </span>
      </>
    ),
    className: 'filter-color-u',
  },
  {
    value: 'B',
    label: (
      <>
        <img
          className="mana-symbol"
          src={symbolUrl('B')}
          alt="B"
          aria-hidden="true"
        />{' '}
        <span className="filter-option-label">
          Black
        </span>
      </>
    ),
    className: 'filter-color-b',
  },
  {
    value: 'R',
    label: (
      <>
        <img
          className="mana-symbol"
          src={symbolUrl('R')}
          alt="R"
          aria-hidden="true"
        />{' '}
        <span className="filter-option-label">
          Red
        </span>
      </>
    ),
    className: 'filter-color-r',
  },
  {
    value: 'G',
    label: (
      <>
        <img
          className="mana-symbol"
          src={symbolUrl('G')}
          alt="G"
          aria-hidden="true"
        />{' '}
        <span className="filter-option-label">
          Green
        </span>
      </>
    ),
    className: 'filter-color-g',
  },
  {
    value: 'C',
    label: (
      <>
        <img
          className="mana-symbol"
          src={symbolUrl('C')}
          alt="C"
          aria-hidden="true"
        />{' '}
        <span className="filter-option-label">
          Colorless
        </span>
      </>
    ),
    className: 'filter-color-c',
  },
  {
    value: 'M',
    label: (
      <>
        <img
          className="mana-symbol"
          src={symbolUrl('M')}
          alt="M"
          aria-hidden="true"
        />{' '}
        <span className="filter-option-label">
          Multicolor
        </span>
      </>
    ),
    className: 'filter-color-m',
  },
]

const RARITY_OPTIONS = [
  { value: 'common', label: 'Common', className: 'filter-rarity-common' },
  { value: 'uncommon', label: 'Uncommon', className: 'filter-rarity-uncommon' },
  { value: 'rare', label: 'Rare', className: 'filter-rarity-rare' },
  { value: 'mythic', label: 'Mythic', className: 'filter-rarity-mythic' },
]

type OpenPanel = 'sort' | 'color' | 'type' | 'rarity' | null

interface BasicFilterProps {
  label: string
  toggleClassName: string
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  sheetTitle: string
  options: FilterSheetOption[]
  selectedValues: string[]
  onSelect: (value: string) => void
  children: ReactNode
}

// Shared by the color/type/rarity controls, which only differ in their
// toggle button content and the options they hand to FilterSheet.
function BasicFilter({
  label,
  toggleClassName,
  isOpen,
  onOpen,
  onClose,
  sheetTitle,
  options,
  selectedValues,
  onSelect,
  children,
}: BasicFilterProps) {
  return (
    <div className="basic-filter">
      <button
        type="button"
        className={toggleClassName}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={label}
        onClick={onOpen}
      >
        {children}
      </button>

      {isOpen && (
        <FilterSheet
          title={sheetTitle}
          options={options}
          selectedValues={selectedValues}
          onSelect={(value) => {
            onSelect(value)
            onClose()
          }}
          onClose={onClose}
        />
      )}
    </div>
  )
}

interface SearchBarProps {
  query: string
  typeValue: string[]
  rarityValue: string[]
  colorValue: string[]
  colorMode: ColorFilterMode
  oracleValue: string
  sortOption: SortOption
  typeOptions: string[]
  setValue: string[]
  setOptions: SetOption[]
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
  onColorModeChange: (value: ColorFilterMode) => void
  onOracleChange: (value: string) => void
  onSetsChange: (value: string[]) => void
  onShowAllPrintsChange: (value: boolean) => void
}

export function SearchBar({
  query,
  typeValue,
  rarityValue,
  colorValue,
  colorMode,
  oracleValue,
  sortOption,
  typeOptions,
  setValue,
  setOptions,
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
  onColorModeChange,
  onOracleChange,
  onSetsChange,
  onShowAllPrintsChange,
}: SearchBarProps) {
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null)
  const closePanel = () => setOpenPanel(null)
  const [searchValue, setSearchValue] = useState(query)
  const [sortMenuPosition, setSortMenuPosition] = useState<{
    top: number
    right: number
  } | null>(null)

  const sortControlRef = useRef<HTMLDivElement>(null)
  const sortMenuRef = useRef<HTMLDivElement>(null)
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

  useEffect(() => {
    if (openPanel !== 'sort') return

    const anchor = sortControlRef.current
    if (anchor) {
      const rect = anchor.getBoundingClientRect()
      setSortMenuPosition({
        top: rect.bottom + 5,
        right: window.innerWidth - rect.right,
      })
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (
        !sortControlRef.current?.contains(target) &&
        !sortMenuRef.current?.contains(target)
      ) {
        closePanel()
      }
    }

    // The menu is portaled and its position is a one-time snapshot, so close
    // it rather than let it drift out of sync while the page scrolls/resizes.
    const closeMenu = () => closePanel()

    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('scroll', closeMenu, true)
    window.addEventListener('resize', closeMenu)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('scroll', closeMenu, true)
      window.removeEventListener('resize', closeMenu)
    }
  }, [openPanel])

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

  const handleSearchKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key !== 'Enter') return

    event.preventDefault()
    isEditingSearchRef.current = false

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current)
      searchDebounceRef.current = null
    }

    onQueryChange(searchValue)
    searchInputRef.current?.blur()
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
    closePanel()
  }

  const handleBasicFilterChange = (
    value: string,
    onChange: (
      value: string[],
    ) => void,
  ) => {
    if (!value || value === 'all') {
      onChange([])
      return
    }

    onChange([value])
  }

  const handleOracleToggle = () => {
    onExpandAllChange(!expandAllCards)

    if (isAdvancedOpen) {
      onAdvancedOpenChange(false)
    }
  }

  if (isAdvancedOpen) {
    return (
      <AdvancedFilters
        colorValue={colorValue}
        colorMode={colorMode}
        oracleValue={oracleValue}
        typeValue={typeValue}
        rarityValue={rarityValue}
        typeOptions={typeOptions}
        setValue={setValue}
        setOptions={setOptions}
        showAllPrints={showAllPrints}
        onColorChange={onColorChange}
        onColorModeChange={
          onColorModeChange
        }
        onOracleChange={onOracleChange}
        onTypeChange={onTypeChange}
        onRarityChange={onRarityChange}
        onSetsChange={onSetsChange}
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
            enterKeyHint="enter"
            value={searchValue}
            onChange={(event) => handleSearchChange(event.target.value)}
            onKeyDown={handleSearchKeyDown}
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
                <path d="M20 4l-6 6" />
                <path d="M14 10h5" />
                <path d="M14 10v-5" />

                <path d="M4 20l6-6" />
                <path d="M10 14H5" />
                <path d="M10 14v5" />
              </>
            ) : (
              <>
                <path d="M14 10l6-6" />
                <path d="M20 4h-5" />
                <path d="M20 4v5" />

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
            aria-expanded={openPanel === 'sort'}
            aria-label="Sort cards"
            onClick={() =>
              setOpenPanel((current) => (current === 'sort' ? null : 'sort'))
            }
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M3 18h6v-2H3v2zm0-5h12v-2H3v2H3zm0-7v2h18V6H3z" />
            </svg>
          </button>

          {openPanel === 'sort' &&
            sortMenuPosition &&
            // Rendered in a portal so the menu isn't clipped/repositioned by
            // the chrome's translateY transform and overflow: hidden (used
            // for the header hide/reveal-on-scroll animation).
            createPortal(
              <div
                ref={sortMenuRef}
                className="sort-menu"
                role="menu"
                aria-label="Sort options"
                style={{
                  top: sortMenuPosition.top,
                  right: sortMenuPosition.right,
                }}
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
              </div>,
              document.body,
            )}
        </div>
      </div>

      <div className="basic-filters-row">
        <BasicFilter
          label="color"
          toggleClassName={`filter-color-toggle ${
            colorValue.length === 1
              ? `filter-color-${colorValue[0].toLowerCase()}`
              : ''
          }`}
          isOpen={openPanel === 'color'}
          onOpen={() => setOpenPanel('color')}
          onClose={closePanel}
          sheetTitle="Select color"
          options={[{ value: '', label: 'All colors' }, ...COLOR_OPTIONS]}
          selectedValues={colorValue}
          onSelect={(value) => handleBasicFilterChange(value, onColorChange)}
        >
          {colorValue.length === 1
            ? COLOR_OPTIONS.find((option) => option.value === colorValue[0])
                ?.label
            : colorValue.includes('all')
              ? 'All colors'
              : 'Color'}
        </BasicFilter>

        <BasicFilter
          label="type"
          toggleClassName="filter-type-toggle"
          isOpen={openPanel === 'type'}
          onOpen={() => setOpenPanel('type')}
          onClose={closePanel}
          sheetTitle="Select type"
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
          onSelect={(value) => handleBasicFilterChange(value, onTypeChange)}
        >
          {typeValue.length === 1 && typeOptions.includes(typeValue[0])
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
        </BasicFilter>

        <BasicFilter
          label="rarity"
          toggleClassName={`filter-rarity-toggle ${
            rarityValue.length === 1
              ? `filter-rarity-${rarityValue[0].toLowerCase()}`
              : ''
          }`}
          isOpen={openPanel === 'rarity'}
          onOpen={() => setOpenPanel('rarity')}
          onClose={closePanel}
          sheetTitle="Select rarity"
          options={[{ value: '', label: 'All rarities' }, ...RARITY_OPTIONS]}
          selectedValues={rarityValue}
          onSelect={(value) => handleBasicFilterChange(value, onRarityChange)}
        >
          {rarityValue.length === 1
            ? RARITY_OPTIONS.find(
                (option) => option.value === rarityValue[0],
              )?.label
            : rarityValue.includes('all')
              ? 'All rarities'
              : 'Rarity'}
        </BasicFilter>

        <button
          type="button"
          className="advanced-toggle"
          aria-label="Show advanced filters"
          aria-expanded={false}
          aria-controls="advanced-filters"
          onClick={() => onAdvancedOpenChange(true)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20.6693 7C20.7527 6.8184 20.7971 6.62572 20.8297 6.37281C21.0319 4.8008 21.133 4.0148 20.672 3.5074C20.2111 3 19.396 3 17.7657 3H6.23433C4.60404 3 3.7889 3 3.32795 3.5074C2.86701 4.0148 2.96811 4.8008 3.17033 6.3728C3.22938 6.8319 3.3276 7.09253 3.62734 7.44867C4.59564 8.59915 6.36901 10.6456 8.85746 12.5061C9.08486 12.6761 9.23409 12.9539 9.25927 13.2614C9.53961 16.6864 9.79643 19.0261 9.93278 20.1778C10.0043 20.782 10.6741 21.2466 11.226 20.8563C12.1532 20.2006 13.8853 19.4657 14.1141 18.2442C14.2223 17.6668 14.3806 16.6588 14.5593 15" />
            <path d="M17.5 8V15M21 11.5L14 11.5" />
          </svg>
        </button>
      </div>
    </section>
  )
}