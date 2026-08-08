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

function symbolUrl(sym: string): string {
  return `https://svgs.scryfall.io/card-symbols/${sym}.svg`
}

function stripParentheticalText(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s{2,}/g, ' ').trim())
    .join('\n')
}

function renderOracleText(text: string) {
  const lines = text.split('\n')

  return lines.flatMap((line, lineIndex) => {
    const parts = line.split(/(\{[^}]+\})/g).filter(Boolean)
    const renderedLine = parts.map((part, partIndex) => {
      const match = part.match(/^\{([^}]+)\}$/)
      if (!match) {
        return <span key={`text-${lineIndex}-${partIndex}`}>{part}</span>
      }

      const symbol = match[1]
      return (
        <img
          key={`sym-${lineIndex}-${partIndex}`}
          className="oracle-symbol"
          src={symbolUrl(symbol)}
          alt={symbol}
          aria-hidden="true"
        />
      )
    })

    if (lineIndex === lines.length - 1) {
      return renderedLine
    }

    return [...renderedLine, <br key={`line-break-${lineIndex}`} />]
  })
}

export function Cards({
  card,
  isOracleExpanded,
  onToggleOracle,
  onOpenDetails,
}: CardsProps) {
  const hasPowerAndToughness = Boolean(card.power || card.toughness)
  const oracleText = isOracleExpanded ? card.oracleText : stripParentheticalText(card.oracleText)

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
          {renderOracleText(oracleText)}
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
