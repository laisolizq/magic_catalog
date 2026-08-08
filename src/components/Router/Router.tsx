import { useEffect, useMemo, useState } from 'react'

import { CatalogPage } from '../../pages/CatalogPage/CatalogPage'

const DEFAULT_ROUTE = '/catalog'

function getRouteFromHash() {
  const rawHash = window.location.hash.replace(/^#/, '')
  return rawHash.startsWith('/') ? rawHash : DEFAULT_ROUTE
}

interface RouterProps {
  onRouteChange: (route: string) => void
}

export function Router({ onRouteChange }: RouterProps) {
  const [route, setRoute] = useState(getRouteFromHash)

  useEffect(() => {
    if (!window.location.hash) {
      window.location.hash = DEFAULT_ROUTE
      return
    }

    const updateRoute = () => {
      const nextRoute = getRouteFromHash()
      setRoute(nextRoute)
      onRouteChange(nextRoute)
    }

    updateRoute()
    window.addEventListener('hashchange', updateRoute)
    return () => window.removeEventListener('hashchange', updateRoute)
  }, [onRouteChange])

  const view = useMemo(() => {
    if (route === '/catalog') {
      return <CatalogPage />
    }

    return <CatalogPage />
  }, [route])

  return <main className="app-main">{view}</main>
}
