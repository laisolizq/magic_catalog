import { InstallPopup } from '../InstallPopup/InstallPopup'
import './AppHeader.css'

export function AppHeader() {
  return (
    <header className="app-header">
      <div className="app-brand">
        <img
          src="logo_cardscade.png"
          alt=""
          className="app-logo"
        />

        <span className="app-name">
          Magic Catalog
        </span>
      </div>

      <InstallPopup />
    </header>
  )
}