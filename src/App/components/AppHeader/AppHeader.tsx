import { NavLink } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { InstallPopup } from '../InstallPopup/InstallPopup'
import { readCatalogMetadata } from '../../../db/sqliteClient'
import type { CatalogArtifactMetadata } from '../../../types/catalog'
import './AppHeader.css'

const DEVELOPER_MODE_STORAGE_KEY = 'magic-catalog-developer-mode'

function formatDatabaseGeneratedAt(generatedAt: string): string | null {
  const date = new Date(generatedAt)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function AppHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isDeveloperMode, setIsDeveloperMode] = useState(() => {
    try {
      return localStorage.getItem(DEVELOPER_MODE_STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })
  const menuCopyTapCount = useRef(0)

  const [databaseGeneratedAt, setDatabaseGeneratedAt] = useState<string | null>(null)

  useEffect(() => {
    if (!isMenuOpen) return

    let cancelled = false

    readCatalogMetadata<CatalogArtifactMetadata>().then((metadata) => {
      if (cancelled) return
      setDatabaseGeneratedAt(metadata?.generatedAt ? formatDatabaseGeneratedAt(metadata.generatedAt) : null)
    }).catch(() => {
      if (!cancelled) setDatabaseGeneratedAt(null)
    })

    return () => {
      cancelled = true
    }
  }, [isMenuOpen])

  const closeMenu = () => {
    setIsMenuOpen(false)
  }

  const handleMenuCopyTap = () => {
    menuCopyTapCount.current += 1

    if (menuCopyTapCount.current < 10) return

    menuCopyTapCount.current = 0
    setIsDeveloperMode((current) => {
      const next = !current

      try {
        localStorage.setItem(DEVELOPER_MODE_STORAGE_KEY, String(next))
      } catch {
        return next
      }

      return next
    })
  }

  const refreshApp = async () => {
    const registration = await navigator.serviceWorker?.getRegistration()
    await registration?.update()
    window.location.reload()
  }

  return (
    <>
      <header className="app-header">
        <div className="app-brand-row">
          <button
            type="button"
            className="menu-toggle"
            aria-label="Open menu"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen(true)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
            </svg>
          </button>

          <div className="app-brand">
            <span className="app-name">
              Cardscade
            </span>
          </div>
        </div>

        <InstallPopup />
      </header>

      {isMenuOpen &&
        // Rendered in a portal so the overlay isn't clipped/repositioned by
        // the chrome's translateY transform (which creates its own
        // containing block for fixed-position descendants).
        createPortal(
        <div
          className="menu-overlay"
          onClick={closeMenu}
        >
          <aside
            className="menu-drawer"
            role="dialog"
            aria-label="Menu"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="menu-close"
              onClick={closeMenu}
              aria-label="Close menu"
            >
              ×
            </button>

            <nav className="menu-navigation" aria-label="Main navigation">
              <NavLink
                to="/catalog"
                className={({ isActive }) =>
                  isActive
                    ? 'menu-item is-active'
                    : 'menu-item'
                }
                onClick={closeMenu}
              >
                Catalog
              </NavLink>

              {isDeveloperMode && (
                <>
                  <NavLink
                    to="/rules"
                    className={({ isActive }) =>
                      isActive
                        ? 'menu-item is-active'
                        : 'menu-item'
                    }
                    onClick={closeMenu}
                  >
                    Rules
                  </NavLink>

                  <NavLink
                    to="/decks"
                    className={({ isActive }) =>
                      isActive
                        ? 'menu-item is-active'
                        : 'menu-item'
                    }
                    onClick={closeMenu}
                  >
                    Decks
                  </NavLink>

                  <NavLink
                    to="/life-counter"
                    className={({ isActive }) =>
                      isActive
                        ? 'menu-item is-active'
                        : 'menu-item'
                    }
                    onClick={closeMenu}
                  >
                    Life Counter
                  </NavLink>
                </>
              )}
            </nav>

            <p
              className="menu-copy"
              role="button"
              tabIndex={0}
              aria-label="Toggle developer mode"
              aria-pressed={isDeveloperMode}
              onClick={handleMenuCopyTap}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  handleMenuCopyTap()
                }
              }}
            >
              Made with love by Red &amp; Lua
            </p>

            <div className="menu-version">
              <div className="menu-version-text">
                <span>Version {__APP_VERSION__}</span>
                {databaseGeneratedAt && (
                  <span>Database: {databaseGeneratedAt}</span>
                )}
              </div>
              <button
                type="button"
                className="menu-refresh"
                aria-label="Refresh app"
                title="Refresh app"
                onClick={() => void refreshApp()}
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
                  <path d="M20 11a8.1 8.1 0 0 0-14.7-4.7L3 9" />
                  <path d="M3 4v5h5" />
                  <path d="M4 13a8.1 8.1 0 0 0 14.7 4.7L21 15" />
                  <path d="M21 20v-5h-5" />
                </svg>
              </button>
            </div>
          </aside>
        </div>,
        document.body,
      )}
    </>
  )
}