import { NavLink } from 'react-router-dom'
import { useState } from 'react'
import { createPortal } from 'react-dom'

import { InstallPopup } from '../InstallPopup/InstallPopup'
import './AppHeader.css'

export function AppHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const closeMenu = () => {
    setIsMenuOpen(false)
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
            </nav>

            <p className="menu-copy">
              Made with love by Red &amp; Lua
            </p>

            <div className="menu-version">
              <span>Version {__APP_VERSION__}</span>
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