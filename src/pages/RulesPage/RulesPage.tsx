import { Link } from 'react-router-dom'

import './RulesPage.css'

export function RulesPage() {
  return (
    <section className="rules-page">
      <header className="rules-header">
          <span className="rules-eyebrow">
            MAGIC: THE GATHERING
          </span>
        <h1>Rules</h1>

        <p>
          Learn the rules, mechanics and concepts of
          Magic: The Gathering.
        </p>
      </header>

      <div className="rules-grid">
        <Link
          to="/rules/keywords-abilities"
          className="rules-card"
        >
          <div className="rules-card-content">
            <h2>Keyword Abilities</h2>

            <p>
              Learn the keyword abilities that define
              what cards can do and how they behave.
            </p>
          </div>

          <span className="rules-card-arrow">
            →
          </span>
        </Link>

        <Link
          to="/rules/keywords-actions"
          className="rules-card"
        >
          <div className="rules-card-content">
            <h2>Keyword Actions</h2>

            <p>
              Learn the game actions represented by
              specific Magic terminology.
            </p>
          </div>

          <span className="rules-card-arrow">
            →
          </span>
        </Link>
      </div>
    </section>
  )
}