import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

function MobileOrientationLock() {
  useEffect(() => {
    const isMobile = window.matchMedia('(pointer: coarse) and (max-width: 640px)').matches
    const orientation = window.screen.orientation

    if (!isMobile || !orientation?.lock) {
      return
    }

    void orientation.lock('portrait').catch(() => {})
  }, [])

  return null
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename="/magic_catalog">
      <MobileOrientationLock />
      <App />
    </BrowserRouter>
  </StrictMode>,
)
