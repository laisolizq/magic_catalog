import { Navigate, Route, Routes } from 'react-router-dom'
import { AppHeader } from './App/components/AppHeader/AppHeader'
import { CatalogPage } from './pages/CatalogPage/CatalogPage'
import { MagicGuidePage } from './pages/MagicGuidePage/MagicGuidePage'
import { KeywordsPage } from './pages/MagicGuidePage/KeywordsPage/KeywordsPage'
import './App.css'

function App() {
  return (
    <div className="app-shell">
      <main className="app-main">
        <AppHeader />

        <Routes>
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/magic-guide" element={<MagicGuidePage />} />
          <Route path="/magic-guide/keywords-abilities" element={<KeywordsPage type="abilities" />} />
          <Route path="/magic-guide/keywords-actions" element={<KeywordsPage type="actions"/>} />
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