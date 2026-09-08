import type { ReactNode } from 'react'

import { AppHeader } from '../../../../App/components/AppHeader/AppHeader'
import type { CatalogImportProgress } from '../../../../services/catalogImport'
import './CatalogChrome.css'

interface AdvancedCatalogChromeProps {
  children: ReactNode
  catalogProgress?: CatalogImportProgress
}

export function AdvancedCatalogChrome({
  children,
  catalogProgress,
}: AdvancedCatalogChromeProps) {
  return (
    <div className="catalog-chrome catalog-advanced-chrome">
      <AppHeader catalogProgress={catalogProgress} />
      {children}
    </div>
  )
}
