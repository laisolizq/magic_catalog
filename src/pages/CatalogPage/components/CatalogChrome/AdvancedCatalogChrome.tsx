import type { ReactNode } from 'react'

import { AppHeader } from '../../../../App/components/AppHeader/AppHeader'
import './CatalogChrome.css'

interface AdvancedCatalogChromeProps {
  children: ReactNode
}

export function AdvancedCatalogChrome({
  children,
}: AdvancedCatalogChromeProps) {
  return (
    <div className="catalog-chrome catalog-advanced-chrome">
      <AppHeader isVisible />
      {children}
    </div>
  )
}
