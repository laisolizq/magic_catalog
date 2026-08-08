import { useState } from 'react'

import './SearchBar.css'

interface SearchBarProps {
  query: string
  setValue: string
  typeValue: string
  rarityValue: string
  colorValue: string
  setOptions: string[]
  typeOptions: string[]
  onQueryChange: (value: string) => void
  onSetChange: (value: string) => void
  onTypeChange: (value: string) => void
  onRarityChange: (value: string) => void
  onColorChange: (value: string) => void
}

export function SearchBar({
  query,
  setValue,
  typeValue,
  rarityValue,
  colorValue,
  setOptions,
  typeOptions,
  onQueryChange,
  onSetChange,
  onTypeChange,
  onRarityChange,
  onColorChange,
}: SearchBarProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)

  return (
    <section className="search-panel" aria-label="Card search">
      <label className="search-label" htmlFor="card-search-input">
        Search cards
      </label>
      <div className="search-input-row">
        <input
          id="card-search-input"
          className="search-input"
          placeholder="set:tla"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        <button
          type="button"
          className="advanced-toggle"
          aria-label={
            isAdvancedOpen
              ? 'Hide advanced query options'
              : 'Show advanced query options'
          }
          aria-expanded={isAdvancedOpen}
          aria-controls="advanced-query-options"
          onClick={() => setIsAdvancedOpen((prev) => !prev)}
        >
          +
        </button>
      </div>

      {isAdvancedOpen && (
        <div id="advanced-query-options">
          <p className="advanced-title">advanced query options</p>
          <div className="filters-grid">
            <label>
              set
              <select
                value={setValue}
                onChange={(event) => onSetChange(event.target.value)}
              >
                <option value="all">all</option>
                {setOptions.map((setOption) => (
                  <option key={setOption} value={setOption}>
                    {setOption}
                  </option>
                ))}
              </select>
            </label>

            <label>
              type
              <select
                value={typeValue}
                onChange={(event) => onTypeChange(event.target.value)}
              >
                <option value="all">all</option>
                {typeOptions.map((typeOption) => (
                  <option key={typeOption} value={typeOption}>
                    {typeOption}
                  </option>
                ))}
              </select>
            </label>

            <label>
              rarity
              <select
                value={rarityValue}
                onChange={(event) => onRarityChange(event.target.value)}
              >
                <option value="all">all</option>
                <option value="common">common</option>
                <option value="uncommon">uncommon</option>
                <option value="rare">rare</option>
                <option value="mythic">mythic</option>
              </select>
            </label>

            <label>
              color
              <select
                value={colorValue}
                onChange={(event) => onColorChange(event.target.value)}
              >
                <option value="all">all</option>
                <option value="W">W</option>
                <option value="U">U</option>
                <option value="B">B</option>
                <option value="R">R</option>
                <option value="G">G</option>
              </select>
            </label>
          </div>
        </div>
      )}
    </section>
  )
}
