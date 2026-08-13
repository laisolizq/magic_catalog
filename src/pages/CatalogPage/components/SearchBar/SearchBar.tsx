import './SearchBar.css'

interface SearchBarProps {
  query: string
  setValue: string
  typeValue: string
  rarityValue: string
  colorValue: string
  setOptions: string[]
  typeOptions: string[]
  isAdvancedOpen: boolean
  expandAllCards: boolean
  onAdvancedOpenChange: (value: boolean) => void
  onExpandAllChange: (value: boolean) => void
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
  isAdvancedOpen,
  expandAllCards,
  onAdvancedOpenChange,
  onExpandAllChange,
  onQueryChange,
  onSetChange,
  onTypeChange,
  onRarityChange,
  onColorChange,
}: SearchBarProps) {
  return (
    <section className="search-panel" aria-label="Card search">
      <div className="search-input-row">
        <input
          id="card-search-input"
          className="search-input"
          aria-label="Search cards"
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
          onClick={() => onAdvancedOpenChange(!isAdvancedOpen)}
        >
          <svg
            className={isAdvancedOpen ? 'is-open' : ''}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6H6z" />
          </svg>
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

          <label className="expand-all-option">
            <input
              type="checkbox"
              checked={expandAllCards}
              onChange={(event) => onExpandAllChange(event.target.checked)}
            />
            <span>Expand  oracles</span>
          </label>
        </div>
      )}
    </section>
  )
}