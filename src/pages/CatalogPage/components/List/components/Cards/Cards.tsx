import type { Card, CardFace } from '../../../../../../types/card'
import { ManaCost } from './components/ManaCost/ManaCost'
import './Cards.css'

interface CardsProps {
  card: Card
  isOracleExpanded: boolean
  onToggleOracle: (cardId: string) => void
  onOpenDetails: (card: Card, faceIndex?: number) => void
}

function getRarityClass(rarity: Card['rarity']) {
  return `rarity-${rarity}`
}

function getFrameClass(colors: CardFace['colors']) {
  if (colors.length === 0) return 'frame-c'
  if (colors.length > 1) return 'frame-multi'
  return `frame-${colors[0].toLowerCase()}`
}

function symbolUrl(sym: string): string {
  return `https://svgs.scryfall.io/card-symbols/${sym}.svg`
}

function setSymbolUrl(setCode: string, rarity: Card['rarity']): string {
  return `https://svgs.scryfall.io/sets/${setCode}.svg?rarity=${rarity}`
}

function stripParentheticalText(text: string): string {
  return text
    .split('\n')
    .map((line) =>
      line
        .replace(/\s*\([^)]*\)\s*/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim(),
    )
    .filter((line) => line.length > 0)
    .join('\n')
}

function renderOracleText(text: string) {
  const lines = text.split('\n')

  return lines.flatMap((line, lineIndex) => {
    const parts = line.split(/(\{[^}]+\})/g).filter(Boolean)

    const renderedLine = parts.map((part, partIndex) => {
      const match = part.match(/^\{([^}]+)\}$/)

      if (!match) {
        return (
          <span key={`text-${lineIndex}-${partIndex}`}>
            {part}
          </span>
        )
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

    return [
      ...renderedLine,
      <br key={`line-break-${lineIndex}`} />,
    ]
  })
}

export function Cards({
  card,
  isOracleExpanded,
  onToggleOracle,
  onOpenDetails,
}: CardsProps) {
  const faces = Array.isArray((card as any).faces)
    ? (card as any).faces as CardFace[]
    : [
        {
          name: (card as any).name,
          manaCost: (card as any).manaCost,
          typeLine: (card as any).typeLine,
          power: (card as any).power,
          toughness: (card as any).toughness,
          oracleText: (card as any).oracleText,
          colors: (card as any).colors ?? [],
          imageUrl: (card as any).imageUrl,
          artCropUrl: (card as any).artCropUrl,
        } as CardFace,
      ]

  return (
    <div className="card-face-group">
      {faces.map((face, faceIndex) => {
        const hasPowerAndToughness = Boolean(face.power || face.toughness)

        const oracleText = isOracleExpanded
          ? face.oracleText
          : stripParentheticalText(face.oracleText)

        return (
          <article
            key={`${card.id}-${faceIndex}`}
            className={`card-tile ${getFrameClass(face.colors)} ${getRarityClass(
              card.rarity,
            )}`}
            onClick={() => onOpenDetails(card, faceIndex)}
            onKeyUp={(event) => {
              if (event.key === 'Enter') {
                onOpenDetails(card)
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={`Open details for ${face.name}`}
          >
            <div className="card-main">
              <header className="card-headline">
                <h3>{face.name}</h3>
                <ManaCost cost={face.manaCost} />
              </header>

              <div className="type-line-row">
                <p className="type-line">{face.typeLine}</p>

                <span
                  className={`set-rarity rarity-${card.rarity}`}
                  aria-label={`${card.set?.toUpperCase?.() ?? ''} ${card.rarity ?? ''}`}
                  title={`${card.set?.toUpperCase?.() ?? ''} • ${card.rarity ?? ''}`}
                >
                  <img
                    className="set-symbol"
                    src={setSymbolUrl(card.set, card.rarity)}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                  />
                </span>
              </div>

              <p
                className={
                  isOracleExpanded
                    ? 'oracle expanded'
                    : 'oracle collapsed'
                }
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
                aria-label={`Toggle oracle text for ${face.name}`}
              >
                {renderOracleText(oracleText)}
              </p>
            </div>

            <aside
              className={`card-media rarity-frame-${card.rarity}`}
              aria-hidden="true"
            >
              <div className="card-art-frame">
                  <img
                    className="card-thumb"
                    src={face.artCropUrl ?? face.imageUrl}
                    alt={face.name}
                    loading="lazy"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenDetails(card, faceIndex)
                    }}
                  />

                {hasPowerAndToughness && (
                  <span className="power-line">
                    {face.power ?? '-'} / {face.toughness ?? '-'}
                  </span>
                )}
              </div>
            </aside>
          </article>
        )
      })}
    </div>
  )
}
