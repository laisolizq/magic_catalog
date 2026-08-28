import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppHeader } from './App/components/AppHeader/AppHeader'
import { CatalogPage } from './pages/CatalogPage/CatalogPage'
import './App.css'

const RulesPage = lazy(async () => {
  const module = await import('./pages/RulesPage/RulesPage')
  return { default: module.RulesPage }
})

const KeywordsPage = lazy(async () => {
  const module = await import('./pages/RulesPage/KeywordsPage/KeywordsPage')
  return { default: module.KeywordsPage }
})

const DecksPage = lazy(async () => {
  const module = await import('./pages/DecksPage/DecksPage')
  return { default: module.DecksPage }
})

const DeckViewPage = lazy(async () => {
  const module = await import('./pages/DecksPage/DeckViewPage')
  return { default: module.DeckViewPage }
})

function App() {
  const { pathname } = useLocation()
  const isCatalogPage = pathname === '/catalog'
  const isDeckViewPage = pathname.startsWith('/decks/')

  return (
    <div className="app-shell">
      <main className="app-main">
        {!isCatalogPage && !isDeckViewPage && <AppHeader />}

        <Suspense fallback={<p role="status">Loading...</p>}>
          <Routes>
            <Route
              path="/catalog"
              element={<CatalogPage />}
            />
            <Route path="/rules" element={<RulesPage />} />
            <Route path="/rules/keywords-abilities" element={<KeywordsPage type="abilities" />} />
            <Route path="/rules/keywords-actions" element={<KeywordsPage type="actions" />} />
            <Route path="/decks" element={<DecksPage />} />
            <Route path="/decks/:deckId" element={<DeckViewPage />} />
            <Route
              path="*"
              element={<Navigate to="/catalog" replace />}
            />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}

export default App