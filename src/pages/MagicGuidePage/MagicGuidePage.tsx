import { Link } from 'react-router-dom'

import './MagicGuidePage.css'

export function MagicGuidePage() {
  return (
    <section className="magic-guide-page">
      <header className="magic-guide-header">
          <span className="magic-guide-eyebrow">
            MAGIC: THE GATHERING
          </span>
        <h1>Magic Guide</h1>

        <p>
          Learn the rules, mechanics and concepts of
          Magic: The Gathering.
        </p>
      </header>

      <div className="magic-guide-grid">
        <Link
          to="/magic-guide/keywords-abilities"
          className="magic-guide-card"
        >
          <div className="magic-guide-card-content">
            <h2>Keyword Abilities</h2>

            <p>
              Learn the keyword abilities that define
              what cards can do and how they behave.
            </p>
          </div>

          <span className="magic-guide-card-arrow">
            →
          </span>
        </Link>

        <Link
          to="/magic-guide/keywords-actions"
          className="magic-guide-card"
        >
          <div className="magic-guide-card-content">
            <h2>Keyword Actions</h2>

            <p>
              Learn the game actions represented by
              specific Magic terminology.
            </p>
          </div>

          <span className="magic-guide-card-arrow">
            →
          </span>
        </Link>
      </div>
    </section>
  )
}