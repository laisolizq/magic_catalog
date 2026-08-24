import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import keywordAbilities from '../../../data/keyword-abilities.json'
import keywordActions from '../../../data/keyword-actions.json'

import './KeywordsPage.css'

type KeywordType = 'abilities' | 'actions'

interface KeywordsPageProps {
  type: KeywordType
}

export function KeywordsPage({
  type,
}: KeywordsPageProps) {
  const [search, setSearch] = useState('')
  const [expandAll, setExpandAll] = useState(true)
  const [expandedKeywords, setExpandedKeywords] = useState<
    Set<string>
  >(new Set())

  const keywords =
    type === 'abilities'
      ? keywordAbilities
      : keywordActions

  const title =
    type === 'abilities'
      ? 'Keyword Abilities'
      : 'Keyword Actions'

  const description =
    type === 'abilities'
      ? 'Abilities that define what a permanent can do or how it behaves.'
      : 'Game actions represented by specific Magic terminology.'

  const filteredKeywords = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase()

    if (!normalizedSearch) {
      return keywords
    }

    return keywords.filter((keyword) =>
      keyword.name
        .toLowerCase()
        .includes(normalizedSearch),
    )
  }, [search, keywords])

  const toggleKeyword = (keywordName: string) => {
    setExpandedKeywords((current) => {
      const next = new Set(current)

      if (next.has(keywordName)) {
        next.delete(keywordName)
      } else {
        next.add(keywordName)
      }

      return next
    })
  }

  const handleExpandToggle = () => {
    setExpandAll((current) => !current)
    setExpandedKeywords(new Set())
  }

  return (
    <section className="keywords-page">
      <Link
        to="/rules"
        className="keywords-back"
      >
        <span
          className="keywords-back-arrow"
          aria-hidden="true"
        >
          ←
        </span>

        <span>Rules</span>
      </Link>

      <header className="keywords-header">
        <div className="keywords-heading">
          <h1>{title}</h1>

          <p>{description}</p>
        </div>

        <span className="keywords-count">
          {filteredKeywords.length}{' '}
          {filteredKeywords.length === 1
            ? 'entry'
            : 'entries'}
        </span>
      </header>

      {/* =========================
          Search / expand
         ========================= */}

      <div className="keywords-search">
        <div className="keywords-search-actions-row">
          <div className="keywords-search-input-wrap">
            <span
              className="keywords-search-input-icon"
              aria-hidden="true"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M10 2a8 8 0 1 0 5.29 14.01l4.35 4.34 1.41-1.41-4.34-4.35A8 8 0 0 0 10 2zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12z" />
              </svg>
            </span>

            <label
              htmlFor="keywords-search-input"
              className="sr-only"
            >
              Search keywords
            </label>

            <input
              id="keywords-search-input"
              className="keywords-search-input"
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder={`Search ${type}...`}
              autoComplete="off"
            />

            {search.length > 0 && (
              <button
                type="button"
                className="keywords-search-input-clear"
                aria-label="Clear search"
                title="Clear search"
                onClick={() => setSearch('')}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4l5.6 5.6 1.4-1.4-5.6-5.6L19 6.4 17.6 5 12 10.6 6.4 5Z" />
                </svg>
              </button>
            )}
          </div>

          <button
            type="button"
            className={`keywords-expand-toggle ${
              expandAll ? 'is-active' : ''
            }`}
            aria-label={
              expandAll
                ? 'Collapse descriptions'
                : 'Expand descriptions'
            }
            aria-pressed={expandAll}
            title={
              expandAll
                ? 'Collapse descriptions'
                : 'Expand descriptions'
            }
            onClick={handleExpandToggle}
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
              {expandAll ? (
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
        </div>
      </div>

      {/* =========================
          Keywords
         ========================= */}

      <div className="keywords-list">
        {filteredKeywords.map((keyword) => {
          const isExpanded =
            expandAll ||
            expandedKeywords.has(keyword.name)

          return (
            <article
              key={keyword.name}
              className={`keyword-entry ${
                !expandAll
                  ? 'is-collapsible'
                  : ''
              } ${
                !expandAll && isExpanded
                  ? 'is-expanded'
                  : ''
              }`}
            >
              {!expandAll ? (
                <button
                  type="button"
                  className="keyword-collapsed-button"
                  onClick={() =>
                    toggleKeyword(keyword.name)
                  }
                  aria-expanded={isExpanded}
                >
                  <span className="keyword-name">
                    {keyword.name}
                  </span>

                  <span
                    className="keyword-expand-icon"
                    aria-hidden="true"
                  >
                    {isExpanded ? '−' : '+'}
                  </span>
                </button>
              ) : (
                <div className="keyword-expanded-content">
                  <h2 className="keyword-name">
                    {keyword.name}
                  </h2>

                  <div className="keyword-separator" />

                  <p className="keyword-description">
                    {keyword.description}
                  </p>
                </div>
              )}

              {!expandAll && isExpanded && (
                <div className="keyword-collapsed-description">
                  <p className="keyword-description">
                    {keyword.description}
                  </p>
                </div>
              )}
            </article>
          )
        })}
      </div>

      {filteredKeywords.length === 0 && (
        <div className="keywords-empty">
          <h2>No keywords found</h2>

          <p>
            Try searching for another keyword.
          </p>
        </div>
      )}
    </section>
  )
}