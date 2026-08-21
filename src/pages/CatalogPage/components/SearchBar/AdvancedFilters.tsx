import { useState } from 'react'
import { symbolUrl } from '../../../../utils/utils.ts'
import './AdvancedFilters.css'

interface AdvancedFiltersProps {
  colorValue: string[]
  typeValue: string[]
  rarityValue: string[]
  typeOptions: string[]
  showAllPrints: boolean

  onColorChange: (value: string[]) => void
  onTypeChange: (value: string[]) => void
  onRarityChange: (value: string[]) => void
  onShowAllPrintsChange: (value: boolean) => void

  onClose: () => void
}

const colors = ['W', 'U', 'B', 'R', 'G', 'C', 'M']

const rarities = [
  'common',
  'uncommon',
  'rare',
  'mythic',
]

export function AdvancedFilters({
  colorValue,
  typeValue,
  rarityValue,
  typeOptions,
  showAllPrints,
  onColorChange,
  onTypeChange,
  onRarityChange,
  onShowAllPrintsChange,
  onClose,
}: AdvancedFiltersProps) {
  /*
   * Temporary selections.
   *
   * These are independent from the filters currently
   * applied to the catalog.
   *
   * Clicking options here does NOT trigger a search.
   */
  const [selectedColors, setSelectedColors] =
    useState<string[]>(colorValue)

  const [selectedTypes, setSelectedTypes] =
    useState<string[]>(typeValue)

  const [selectedRarities, setSelectedRarities] =
    useState<string[]>(rarityValue)

  const [selectedShowAllPrints, setSelectedShowAllPrints] =
    useState<boolean>(showAllPrints)

  /*
   * Toggle a value in a temporary selection.
   */
  const toggleValue = (
    values: string[],
    value: string,
    setValues: (value: string[]) => void,
  ) => {
    if (values.includes(value)) {
      setValues(
        values.filter((item) => item !== value),
      )
    } else {
      setValues([...values, value])
    }
  }

  /*
   * Apply all temporary selections at once.
   */
  const handleAccept = () => {
    onColorChange(selectedColors)
    onTypeChange(selectedTypes)
    onRarityChange(selectedRarities)
    onShowAllPrintsChange(selectedShowAllPrints)

    onClose()
  }

  /*
   * Close without applying anything.
   *
   * The parent values haven't changed, so all temporary
   * changes are discarded.
   */
  const handleCancel = () => {
    onClose()
  }

  /*
   * Clear all filters immediately.
   *
   * Unlike the other options, this is applied immediately:
   * - remove every filter
   * - show all cards
   * - close the advanced filters view
   */
  const handleClear = () => {
    setSelectedColors([])
    setSelectedTypes([])
    setSelectedRarities([])
    setSelectedShowAllPrints(false)

    onColorChange([])
    onTypeChange([])
    onRarityChange([])
    onShowAllPrintsChange(false)

    onClose()
  }

  return (
    <section
      className="advanced-filters"
      aria-label="Advanced filters"
    >
      <div className="advanced-filters-header">
        <button
          type="button"
          className="advanced-back"
          onClick={handleCancel}
          aria-label="Close advanced filters"
        >
          ←
        </button>

        <h2>Filters</h2>
      </div>

      {/* =========================
          COLOR
          ========================= */}

      <div className="advanced-filter-section">
        <h3>Color</h3>

        <div className="advanced-options color-options">
          {colors.map((color) => (
            <button
              key={color}
              type="button"
              className={`filter-option filter-color-${color.toLowerCase()} ${
                selectedColors.includes(color)
                  ? 'is-selected'
                  : ''
              }`}
              aria-pressed={selectedColors.includes(
                color,
              )}
              onClick={() =>
                toggleValue(
                  selectedColors,
                  color,
                  setSelectedColors,
                )
              }
            >
              <img
                src={symbolUrl(color)}
                alt={color}
                aria-hidden="true"
                width="18"
                height="18"
              />
            </button>
          ))}
        </div>
      </div>

      {/* =========================
          TYPE
          ========================= */}

      <div className="advanced-filter-section">
        <h3>Type</h3>

        <div className="advanced-options">
          {typeOptions.map((type) => (
            <button
              key={type}
              type="button"
              className={`filter-option ${
                selectedTypes.includes(type)
                  ? 'is-selected'
                  : ''
              }`}
              aria-pressed={selectedTypes.includes(
                type,
              )}
              onClick={() =>
                toggleValue(
                  selectedTypes,
                  type,
                  setSelectedTypes,
                )
              }
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* =========================
          RARITY
          ========================= */}

      <div className="advanced-filter-section">
        <h3>Rarity</h3>

        <div className="advanced-options">
          {rarities.map((rarity) => (
            <button
              key={rarity}
              type="button"
              className={`filter-option filter-rarity-${rarity} ${
                selectedRarities.includes(rarity)
                  ? 'is-selected'
                  : ''
              }`}
              aria-pressed={selectedRarities.includes(
                rarity,
              )}
              onClick={() =>
                toggleValue(
                  selectedRarities,
                  rarity,
                  setSelectedRarities,
                )
              }
            >
                  {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* =========================
          PRINTS
          ========================= */}

      <div className="advanced-filter-section">
        <h3>Prints</h3>

        <label className="advanced-checkbox">
          <input
            type="checkbox"
            checked={selectedShowAllPrints}
            onChange={(event) =>
              setSelectedShowAllPrints(event.target.checked)
            }
          />
          Show all prints
        </label>
      </div>

      {/* =========================
          ACTIONS
          ========================= */}

      <div className="advanced-filters-actions">
        <button
          type="button"
          className="advanced-cancel"
          onClick={handleCancel}
        >
          Cancel
        </button>

        <button
          type="button"
          className="advanced-clear"
          onClick={handleClear}
        >
          Clear filters
        </button>

        <button
          type="button"
          className="advanced-accept"
          onClick={handleAccept}
        >
          Accept
        </button>
      </div>
    </section>
  )
}