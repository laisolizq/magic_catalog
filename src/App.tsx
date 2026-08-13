import { Navigate, Route, Routes } from 'react-router-dom'

import { AppHeader } from './App/components/AppHeader/AppHeader'
import { CatalogPage } from './pages/CatalogPage/CatalogPage'
import './App.css'

function App() {
  return (
    <div className="app-shell">
      {/* <Navigation /> */}
      <AppHeader />
      <main className="app-main">
        <Routes>
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="*" element={<Navigate to="/catalog" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
