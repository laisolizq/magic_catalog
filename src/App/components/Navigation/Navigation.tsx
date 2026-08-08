import { Link, NavLink } from 'react-router-dom'

import './Navigation.css'

const routes = [{ label: 'Catalog', path: '/catalog' }]

export function Navigation() {
  return (
    <header className="topbar" aria-label="Navigation">
      <Link className="brand" to="/catalog">
        Magic Catalog
      </Link>

      <nav>
        <ul className="nav-list">
          {routes.map((route) => (
            <li key={route.path}>
              <NavLink
                className={({ isActive }) =>
                  isActive ? 'nav-item is-active' : 'nav-item'
                }
                to={route.path}
              >
                {route.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
