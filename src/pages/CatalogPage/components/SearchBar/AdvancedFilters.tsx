import { useEffect, useMemo, useRef, useState } from 'react'
import Fuse from 'fuse.js'
import {
  type ColorFilterMode,
} from '../../../../utils/scryfallQuery'
import { symbolUrl } from '../../../../utils/utils.ts'
import type { SetOption } from '../../../../types/catalog'
import './AdvancedFilters.css'

interface AdvancedFiltersProps {
  colorValue: string[]
  colorMode: ColorFilterMode
  oracleValue: string

  setValue: string[]
  setOptions: SetOption[]
  showAllPrints: boolean

  onColorChange: (value: string[]) => void
  onColorModeChange: (
    value: ColorFilterMode,
  ) => void
  onOracleChange: (value: string) => void

  onSetsChange: (value: string[]) => void
  onShowAllPrintsChange: (value: boolean) => void

  onClose: () => void
}

const colors = [
  'W',
  'U',
  'B',
  'R',
  'G',
  'C',
  'M',
]

const colorModes: {
  value: ColorFilterMode
  label: string
}[] = [
  {
    value: 'exactly',
    label: 'Exactly',
  },
  {
    value: 'including',
    label: 'Including',
  },
  {
    value: 'atMost',
    label: 'At most',
  },
]

const MAX_SET_RESULTS = 6

function setIconUrl(code: string): string {
  return `https://svgs.scryfall.io/sets/${code.toLowerCase()}.svg`
}

export function AdvancedFilters({
  colorValue,
  colorMode,
  oracleValue,
  setValue,
  setOptions,
  showAllPrints,
  onColorChange,
  onColorModeChange,
  onOracleChange,
  onSetsChange,
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

  const [selectedColorMode, setSelectedColorMode] =
    useState<ColorFilterMode>(colorMode)

  const [selectedOracle, setSelectedOracle] =
    useState(oracleValue)

  const [selectedSets, setSelectedSets] =
    useState<string[]>(setValue)

  const [setSearchQuery, setSetSearchQuery] = useState('')
  const [isSetSearchOpen, setIsSetSearchOpen] = useState(false)

  const [selectedShowAllPrints, setSelectedShowAllPrints] =
    useState<boolean>(showAllPrints)

  const colorOptionsRef = useRef<HTMLDivElement>(null)
  const [colorOptionsWidth, setColorOptionsWidth] = useState<number | null>(
    null,
  )

  useEffect(() => {
    const el = colorOptionsRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setColorOptionsWidth(entry.contentRect.width)
    })
    observer.observe(el)

    return () => observer.disconnect()
  }, [])

  const setFuse = useMemo(
    () =>
      new Fuse(setOptions, {
        keys: ['name', 'code'],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [setOptions],
  )

  const setSearchResults = useMemo(() => {
    const query = setSearchQuery.trim()

    const matches =
      query.length === 0
        ? setOptions
            .filter(
              (set) => set.setType === 'core' || set.setType === 'expansion',
            )
        : setFuse.search(query, { limit: MAX_SET_RESULTS }).map((result) => result.item)

    return matches.filter((set) => !selectedSets.includes(set.code))
  }, [setFuse, setOptions, setSearchQuery, selectedSets])

  const handleSelectSet = (code: string) => {
    if (!selectedSets.includes(code)) {
      setSelectedSets([...selectedSets, code])
    }
    setSetSearchQuery('')
  }

  const handleRemoveSet = (code: string) => {
    setSelectedSets(selectedSets.filter((value) => value !== code))
  }

  const handleInputNext = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.blur()
    }
  }

  /*
   * Toggle a value in a temporary selection.
   */

  const toggleValue = (
    values: string[],
    value: string,
    setValues: (
      value: string[],
    ) => void,
  ) => {
    if (values.includes(value)) {
      setValues(
        values.filter(
          (item) => item !== value,
        ),
      )
    } else {
      setValues([
        ...values,
        value,
      ])
    }
  }

  /*
   * Apply all temporary selections at once.
   */

  const handleAccept = () => {
    onColorChange(selectedColors)
    onColorModeChange(selectedColorMode)
    onOracleChange(selectedOracle)

    onSetsChange(selectedSets)
    onShowAllPrintsChange(selectedShowAllPrints)

    onClose()
  }

  /*
   * Close without applying anything.
   */

  const handleCancel = () => {
    onClose()
  }

  return (
    <section
      className="advanced-filters"
      aria-label="Advanced filters"
    >
      {/* =========================
          SETS
          ========================= */}

      <div className="advanced-filter-section">
        <h3>Sets</h3>

        {selectedSets.length > 0 && (
          <div className="advanced-options set-chips">
            {selectedSets.map((code) => (
              <div
                key={code}
                className="set-chip"
              >
                {code.toUpperCase()}

                <button
                  type="button"
                  className="set-chip-remove"
                  aria-label={`Remove set ${code.toUpperCase()}`}
                  onClick={() => handleRemoveSet(code)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="set-search">
          <input
            type="text"
            className="set-search-input"
            placeholder="Search sets by name..."
            enterKeyHint="next"
            value={setSearchQuery}
            onChange={(event) => setSetSearchQuery(event.target.value)}
            onKeyDown={handleInputNext}
            onFocus={() => setIsSetSearchOpen(true)}
            onBlur={() => {
              // Let a result's onClick fire before the list disappears.
              window.setTimeout(() => setIsSetSearchOpen(false), 150)
            }}
          />

          {isSetSearchOpen && (
            <div
              className="set-search-results"
              role="listbox"
              aria-label="Set search results"
            >
              {setSearchResults.length === 0 ? (
                <p className="set-search-empty">No sets found.</p>
              ) : (
                setSearchResults.map((set) => (
                  <button
                    key={set.code}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="set-search-result"
                    onClick={() => handleSelectSet(set.code)}
                  >
                    <img
                      className="set-search-icon"
                      src={setIconUrl(set.code)}
                      alt=""
                      aria-hidden="true"
                    />
                    <span className="set-search-name">{set.name}</span>
                    <span className="set-search-code">
                      {set.code.toUpperCase()}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <label className="oracle-filter">
          <h3>Oracle</h3>
          <input
            type="text"
            className="set-search-input"
            placeholder="Oracle contains..."
            enterKeyHint="next"
            value={selectedOracle}
            onChange={(event) => setSelectedOracle(event.target.value)}
            onKeyDown={handleInputNext}
          />
        </label>
      </div>

      {/* =========================
          COLOR
          ========================= */}

      <div className="advanced-filter-section">
        <h3>Color</h3>

        <div
          className="advanced-options color-options"
          ref={colorOptionsRef}
        >
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
                className="mana-symbol"
                src={symbolUrl(color)}
                alt={color}
                aria-hidden="true"
                width="18"
                height="18"
              />
            </button>
          ))}
        </div>

        {/* =========================
            COLOR MODE
            ========================= */}

        <div
          className="color-filter-modes"
          role="group"
          aria-label="Color matching mode"
          style={
            colorOptionsWidth != null
              ? { width: colorOptionsWidth }
              : undefined
          }
        >
          {colorModes.map((mode) => (
            <button
              key={mode.value}
              type="button"
              className={`color-filter-mode ${
                selectedColorMode === mode.value
                  ? 'is-selected'
                  : ''
              }`}
              aria-pressed={
                selectedColorMode === mode.value
              }
              onClick={() =>
                setSelectedColorMode(
                  mode.value,
                )
              }
            >
              {mode.label}
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
            checked={
              selectedShowAllPrints
            }
            onChange={(event) =>
              setSelectedShowAllPrints(
                event.target.checked,
              )
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
          className="advanced-accept"
          onClick={handleAccept}
        >
          Accept
        </button>
      </div>
    </section>
  )
}