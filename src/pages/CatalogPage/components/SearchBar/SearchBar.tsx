import { useState } from 'react'

import { AdvancedFilters } from './AdvancedFilters'
import './SearchBar.css'

type SortOption =
  | 'default'
  | 'name-asc'
  | 'name-desc'
  | 'cmc-asc'
  | 'cmc-desc'
  | 'set-asc'
  | 'set-desc'

interface SearchBarProps {
  query: string
  setValue: string[]
  typeValue: string[]
  rarityValue: string[]
  colorValue: string[]
  sortOption: SortOption
  setOptions: string[]
  typeOptions: string[]
  isAdvancedOpen: boolean
  expandAllCards: boolean
  showAllPrints: boolean

  onAdvancedOpenChange: (value: boolean) => void
  onExpandAllChange: (value: boolean) => void
  onSortChange: (value: SortOption) => void
  onQueryChange: (value: string) => void

  onSetChange: (value: string[]) => void
  onTypeChange: (value: string[]) => void
  onRarityChange: (value: string[]) => void
  onColorChange: (value: string[]) => void
  onShowAllPrintsChange: (value: boolean) => void
}

export function SearchBar({
  query,
  setValue,
  typeValue,
  rarityValue,
  colorValue,
  sortOption,
  setOptions,
  typeOptions,
  isAdvancedOpen,
  expandAllCards,
  showAllPrints,
  onAdvancedOpenChange,
  onExpandAllChange,
  onSortChange,
  onQueryChange,
  onSetChange,
  onTypeChange,
  onRarityChange,
  onColorChange,
  onShowAllPrintsChange,
}: SearchBarProps) {
  const [isSortOpen, setIsSortOpen] = useState(false)

  const handleSortSelect = (value: SortOption) => {
    onSortChange(value)
    setIsSortOpen(false)
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
        setValue={setValue}
        setOptions={setOptions}
        typeOptions={typeOptions}
        showAllPrints={showAllPrints}
        onColorChange={onColorChange}
        onTypeChange={onTypeChange}
        onRarityChange={onRarityChange}
        onSetChange={onSetChange}
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
            className="search-input"
            aria-label="Search cards"
            placeholder="set:tla"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
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
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 5c-6 0-10 7-10 7s4 7 10 7 10-7 10-7-4-7-10-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" />
          </svg>
        </button>

        <div className="sort-control">
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
              <button
                type="button"
                role="menuitemradio"
                aria-checked={sortOption === 'default'}
                onClick={() => handleSortSelect('default')}
              >
                Original
              </button>

              <button
                type="button"
                role="menuitemradio"
                aria-checked={sortOption === 'name-asc'}
                onClick={() => handleSortSelect('name-asc')}
              >
                Name↑
              </button>

              <button
                type="button"
                role="menuitemradio"
                aria-checked={sortOption === 'name-desc'}
                onClick={() => handleSortSelect('name-desc')}
              >
                Name↓
              </button>

              <button
                type="button"
                role="menuitemradio"
                aria-checked={sortOption === 'cmc-asc'}
                onClick={() => handleSortSelect('cmc-asc')}
              >
                CMC↑
              </button>

              <button
                type="button"
                role="menuitemradio"
                aria-checked={sortOption === 'cmc-desc'}
                onClick={() => handleSortSelect('cmc-desc')}
              >
                CMC↓
              </button>

              <button
                type="button"
                role="menuitemradio"
                aria-checked={sortOption === 'set-asc'}
                onClick={() => handleSortSelect('set-asc')}
              >
                Set↑
              </button>

              <button
                type="button"
                role="menuitemradio"
                aria-checked={sortOption === 'set-desc'}
                onClick={() => handleSortSelect('set-desc')}
              >
                Set↓
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="basic-filters-row">
        <label className="basic-filter">
          <select
            className={`filter-color ${
              colorValue.length === 1
                ? `filter-color-${colorValue[0].toLowerCase()}`
                : ''
            }`}
            value={colorValue.length === 1 ? colorValue[0] : ''}
            aria-label="color"
            onChange={(event) =>
              handleBasicFilterChange(
                event.target.value,
                onColorChange,
              )
            }
          >
            <option value="">COLOR</option>
            <option value="all">all</option>
            <option value="W">W</option>
            <option value="U">U</option>
            <option value="B">B</option>
            <option value="R">R</option>
            <option value="G">G</option>
          </select>
        </label>

        <label className="basic-filter">
          <select
            className="filter-type"
            value={typeValue.length === 1 ? typeValue[0] : ''}
            aria-label="type"
            onChange={(event) =>
              handleBasicFilterChange(
                event.target.value,
                onTypeChange,
              )
            }
          >
            <option value="">TYPE</option>
            <option value="all">all</option>

            {typeOptions.map((typeOption) => (
              <option key={typeOption} value={typeOption}>
                {typeOption}
              </option>
            ))}
          </select>
        </label>

        <label className="basic-filter">
          <select
            className={`filter-rarity ${
              rarityValue.length === 1
                ? `filter-rarity-${rarityValue[0].toLowerCase()}`
                : ''
            }`}
            value={
              rarityValue.length === 1
                ? rarityValue[0]
                : ''
            }
            aria-label="rarity"
            onChange={(event) =>
              handleBasicFilterChange(
                event.target.value,
                onRarityChange,
              )
            }
          >
            <option value="">RARITY</option>
            <option value="all">all</option>
            <option value="common">common</option>
            <option value="uncommon">uncommon</option>
            <option value="rare">rare</option>
            <option value="mythic">mythic</option>
          </select>
        </label>

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