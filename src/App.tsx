import { Navigate, Route, Routes } from 'react-router-dom'
import { AppHeader } from './App/components/AppHeader/AppHeader'
import { CatalogPage } from './pages/CatalogPage/CatalogPage'
import { RulesPage } from './pages/RulesPage/RulesPage'
import { KeywordsPage } from './pages/RulesPage/KeywordsPage/KeywordsPage'
import './App.css'

function App() {
  return (
    <div className="app-shell">
      <main className="app-main">
        <AppHeader />

        <Routes>
          <Route path="/catalog" element={<CatalogPage />} />
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