import { useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppHeader } from './App/components/AppHeader/AppHeader'
import { CatalogPage } from './pages/CatalogPage/CatalogPage'
import { RulesPage } from './pages/RulesPage/RulesPage'
import { KeywordsPage } from './pages/RulesPage/KeywordsPage/KeywordsPage'
import { SCROLL_SENSITIVITY } from './config/ui'
import './App.css'

function App() {
  const { pathname } = useLocation()
  const isCatalogPage = pathname === '/catalog'
  const [isHeaderVisible, setIsHeaderVisible] = useState(true)
  const [areAdvancedFiltersOpen, setAreAdvancedFiltersOpen] = useState(false)
  const lastScrollY = useRef(0)

  useEffect(() => {
    lastScrollY.current = window.scrollY
    const resetVisibilityFrame = window.requestAnimationFrame(() => {
      setIsHeaderVisible(true)
    })

    if (!isCatalogPage || areAdvancedFiltersOpen) {
      return () => window.cancelAnimationFrame(resetVisibilityFrame)
    }

    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const delta = currentScrollY - lastScrollY.current

      if (currentScrollY <= 0 || delta < -SCROLL_SENSITIVITY) {
        setIsHeaderVisible(true)
      } else if (delta > SCROLL_SENSITIVITY) {
        setIsHeaderVisible(false)
      }

      lastScrollY.current = currentScrollY
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.cancelAnimationFrame(resetVisibilityFrame)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [isCatalogPage, areAdvancedFiltersOpen])

  return (
    <div className="app-shell">
      <main className="app-main">
        <AppHeader isVisible={isHeaderVisible || !isCatalogPage} />

        <Routes>
          <Route
            path="/catalog"
            element={
              <CatalogPage
                isHeaderVisible={isHeaderVisible}
                onAdvancedFiltersOpenChange={setAreAdvancedFiltersOpen}
              />
            }
          />
          <Route path="/rules" element={<RulesPage />} />
          <Route path="/rules/keywords-abilities" element={<KeywordsPage type="abilities" />} />
          <Route path="/rules/keywords-actions" element={<KeywordsPage type="actions"/>} />
          <Route
            path="*"
            element={<Navigate to="/catalog" replace />}
          />
        </Routes>
      </main>
    </div>
  )
}

export default App