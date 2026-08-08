import { useCallback, useState } from 'react'

import { InstallPopup } from './components/InstallPopup/InstallPopup'
import { Navigation } from './components/Navigation/Navigation'
import { Router } from './components/Router/Router'
import './App.css'

function App() {
  const [currentRoute, setCurrentRoute] = useState('/catalog')

  const handleNavigate = useCallback((route: string) => {
    window.location.hash = route
    setCurrentRoute(route)
  }, [])

  const handleRouteChange = useCallback((route: string) => {
    setCurrentRoute(route)
  }, [])

  return (
    <div className="app-shell">
      <Navigation currentRoute={currentRoute} onNavigate={handleNavigate} />
      <Router onRouteChange={handleRouteChange} />
      <InstallPopup />
    </div>
  )
}

export default App
