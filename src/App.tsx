import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppHeader } from './App/components/AppHeader/AppHeader'
import './App.css'

const CatalogPage = lazy(async () => {
  const module = await import('./pages/CatalogPage/CatalogPage')
  return { default: module.CatalogPage }
})

const RulesPage = lazy(async () => {
  const module = await import('./pages/RulesPage/RulesPage')
  return { default: module.RulesPage }
})

const KeywordsPage = lazy(async () => {
  const module = await import('./pages/RulesPage/KeywordsPage/KeywordsPage')
  return { default: module.KeywordsPage }
})

function App() {
  const { pathname } = useLocation()
  const isCatalogPage = pathname === '/catalog'

  return (
    <div className="app-shell">
      <main className="app-main">
        {!isCatalogPage && <AppHeader />}

        <Suspense fallback={<p role="status">Loading...</p>}>
          <Routes>
            <Route
              path="/catalog"
              element={<CatalogPage />}
            />
            <Route path="/rules" element={<RulesPage />} />
            <Route path="/rules/keywords-abilities" element={<KeywordsPage type="abilities" />} />
            <Route path="/rules/keywords-actions" element={<KeywordsPage type="actions"/>} />
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