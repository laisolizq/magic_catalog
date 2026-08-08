import type { Card } from '../../types/card'

interface CardsProps {
  card: Card
  isOracleExpanded: boolean
  onToggleOracle: (cardId: string) => void
  onOpenDetails: (card: Card) => void
}

function getRarityClass(rarity: Card['rarity']) {
  return `rarity-${rarity}`
}

function getFrameClass(colors: Card['colors']) {
  if (colors.length === 0) return 'frame-c'
  if (colors.length > 1) return 'frame-multi'
  return `frame-${colors[0].toLowerCase()}`
}

export function Cards({
  card,
  isOracleExpanded,
  onToggleOracle,
  onOpenDetails,
}: CardsProps) {
  return (
    <article
      className={`card-tile ${getFrameClass(card.colors)} ${getRarityClass(card.rarity)}`}
      onClick={() => onOpenDetails(card)}
      onKeyUp={(event) => {
        if (event.key === 'Enter') {
          onOpenDetails(card)
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open details for ${card.name}`}
    >
      <img className="card-thumb" src={card.imageUrl} alt={card.name} loading="lazy" />

      <div className="card-main">
        <header className="card-headline">
          <h3>{card.name}</h3>
          <span className="mana-cost">{card.manaCost || '-'}</span>
        </header>

        <p className="type-line">{card.typeLine}</p>

        {(card.power || card.toughness) && (
          <p className="power-line">
            {card.power ?? '-'} / {card.toughness ?? '-'}
          </p>
        )}

        <button
          className="oracle-toggle"
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onToggleOracle(card.id)
          }}
          aria-expanded={isOracleExpanded}
        >
          Card Oracle
        </button>

        <p className={isOracleExpanded ? 'oracle expanded' : 'oracle collapsed'}>
          {card.oracleText}
        </p>
      </div>
    </article>
  )
}
