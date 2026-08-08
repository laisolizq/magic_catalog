import { Navigate, Route, Routes } from 'react-router-dom'

import { InstallPopup } from './App/components/InstallPopup/InstallPopup'
import { Navigation } from './App/components/Navigation/Navigation'
import { CatalogPage } from './pages/CatalogPage/CatalogPage'
import './App.css'

function App() {
  return (
    <div className="app-shell">
      <Navigation />
      <main className="app-main">
        <Routes>
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="*" element={<Navigate to="/catalog" replace />} />
        </Routes>
      </main>
      <InstallPopup />
    </div>
  )
}

export default App
