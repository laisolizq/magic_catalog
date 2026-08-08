interface NavigationProps {
  currentRoute: string
  onNavigate: (route: string) => void
}

const routes = [{ label: 'Catalog', path: '/catalog' }]

export function Navigation({ currentRoute, onNavigate }: NavigationProps) {
  return (
    <header className="topbar" aria-label="Navigation">
      <button className="brand" type="button" onClick={() => onNavigate('/catalog')}>
        Magic Catalog
      </button>

      <nav>
        <ul className="nav-list">
          {routes.map((route) => (
            <li key={route.path}>
              <button
                type="button"
                className={route.path === currentRoute ? 'nav-item is-active' : 'nav-item'}
                onClick={() => onNavigate(route.path)}
              >
                {route.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
