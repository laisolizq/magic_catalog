import type { ReactNode } from 'react'

import { AppHeader } from '../../../../App/components/AppHeader/AppHeader'
import './CatalogChrome.css'

interface BasicCatalogChromeProps {
  isVisible: boolean
  children: ReactNode
}

export function BasicCatalogChrome({
  isVisible,
  children,
}: BasicCatalogChromeProps) {
  return (
    <div
      className={`catalog-chrome catalog-basic-chrome ${
        isVisible ? 'catalog-chrome-visible' : 'catalog-chrome-hidden'
      }`}
    >
      <AppHeader isVisible />
      {children}
    </div>
  )
}
