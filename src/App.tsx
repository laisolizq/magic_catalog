import { Navigate, Route, Routes } from 'react-router-dom'

import { CatalogPage } from './pages/CatalogPage/CatalogPage'
import './App.css'

function App() {
  return (
    <div className="app-shell">
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
