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
  return (
    <section className="search-panel" aria-label="Card search">
      <label className="search-label" htmlFor="card-search-input">
        Query with a default query that can change (we can change it)
      </label>
      <input
        id="card-search-input"
        className="search-input"
        placeholder="Search by card name, type, mana cost"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
      />

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
    </section>
  )
}
