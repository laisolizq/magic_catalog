import type { Card } from '../../../../../../types/card'
import { ManaCost } from './components/ManaCost/ManaCost'
import './Cards.css'

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
  const hasPowerAndToughness = Boolean(card.power || card.toughness)

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
      <div className="card-main">
        <header className="card-headline">
          <h3>{card.name}</h3>
          <ManaCost cost={card.manaCost} />
        </header>

        <p className="type-line">{card.typeLine}</p>



        <p
          className={isOracleExpanded ? 'oracle expanded' : 'oracle collapsed'}
          onClick={(event) => {
            event.stopPropagation()
            onToggleOracle(card.id)
          }}
          onKeyUp={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.stopPropagation()
              onToggleOracle(card.id)
            }
          }}
          role="button"
          tabIndex={0}
          aria-expanded={isOracleExpanded}
          aria-label={`Toggle oracle text for ${card.name}`}
        >
          {card.oracleText}
        </p>
      </div>

      <aside className={`card-media rarity-frame-${card.rarity}`} aria-hidden="true">
        <div className="card-art-frame">
          <img className="card-thumb" src={card.artCropUrl ?? card.imageUrl} alt={card.name} loading="lazy" />
          {hasPowerAndToughness && (
            <span className="power-line">
              {card.power ?? '-'} / {card.toughness ?? '-'}
            </span>
          )}
        </div>
      </aside>
    </article>
  )
}
