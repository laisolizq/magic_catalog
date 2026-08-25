import type { Card, CardFace } from '../../../../../../types/card'
import { symbolUrl } from '../../../../../../utils/utils'
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

function setSymbolUrl(setCode: string, rarity: Card['rarity']): string {
  return `https://svgs.scryfall.io/sets/${setCode}.svg?rarity=${rarity}`
}

// Shortens the "Legendary" supertype so long type lines take up less room.
function abbreviateTypeLine(typeLine: string): string {
  return typeLine.replace(/\bLegendary\b/g, 'Lgd.')
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

// Reminder text in parentheses is rendered in a softer, cursive style.
// Parens can span across mana symbols (e.g. "Equip {2} ({2}: Attach ...)"),
// so reminder state is tracked across the whole line rather than per chunk.
function renderOracleText(text: string) {
  const lines = text.split('\n')

  return lines.flatMap((line, lineIndex) => {
    const parts = line.split(/(\{[^}]+\})/g).filter(Boolean)

    const renderedLine: React.ReactNode[] = []
    let inReminder = false
    let buffer = ''
    let bufferIsReminder = false

    const flushBuffer = (key: string) => {
      if (!buffer) return

      renderedLine.push(
        bufferIsReminder ? (
          <em key={key} className="oracle-reminder">
            {buffer}
          </em>
        ) : (
          <span key={key}>{buffer}</span>
        ),
      )

      buffer = ''
    }

    parts.forEach((part, partIndex) => {
      const match = part.match(/^\{([^}]+)\}$/)

      if (!match) {
        for (const char of part) {
          if (char === '(') inReminder = true

          if (inReminder !== bufferIsReminder) {
            flushBuffer(
              `text-${lineIndex}-${partIndex}-${renderedLine.length}`,
            )
            bufferIsReminder = inReminder
          }

          buffer += char

          if (char === ')') inReminder = false
        }

        return
      }

      flushBuffer(`text-${lineIndex}-${partIndex}`)

      const symbol = match[1]

      renderedLine.push(
        <img
          key={`sym-${lineIndex}-${partIndex}`}
          className={
            inReminder
              ? 'oracle-symbol oracle-reminder'
              : 'oracle-symbol'
          }
          src={symbolUrl(symbol)}
          alt={symbol}
          aria-hidden="true"
        />,
      )
    })

    flushBuffer(`text-${lineIndex}-end`)

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
  const faces: CardFace[] = card.faces

  const getFaceImage = (face: CardFace) =>
    face.artCropUrl ?? face.imageUrl

  return (
    <div className="card-face-group">
      {faces.map((face, faceIndex) => {
        const hasPowerAndToughness = Boolean(
          face.power || face.toughness,
        )
        const hasLoyalty = Boolean(face.loyalty)

        /*
         * Adventure cards can have two faces that use the same
         * physical image. In that case we keep both faces rendered,
         * but only show the image on the first face.
         */
        const hasSharedImage =
          faceIndex > 0 &&
          getFaceImage(face) === getFaceImage(faces[0])

        const oracleText = isOracleExpanded
          ? face.oracleText
          : stripParentheticalText(face.oracleText)

        return (
          <article
            key={`${card.id}-${faceIndex}`}
            data-card-id={card.id}
            data-face-index={faceIndex}
            className={`card-tile ${getFrameClass(
              face.colors,
            )} ${getRarityClass(card.rarity)}`}
            onClick={() => onOpenDetails(card, faceIndex)}
            onKeyUp={(event) => {
              if (event.key === 'Enter') {
                onOpenDetails(card, faceIndex)
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={`Open details for ${face.name}`}
          >
            {!hasSharedImage && (
              <aside
                className={`card-media rarity-frame-${card.rarity}`}
                aria-hidden="true"
              >
                <div className="card-art-frame">
                  <img
                    className="card-thumb"
                    src={getFaceImage(face)}
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

                  {!hasPowerAndToughness && hasLoyalty && (
                    <span className="power-line">
                      {face.loyalty}
                    </span>
                  )}
                </div>
              </aside>
            )}

            <div className="card-main">
              <header className="card-headline">
                <h3>{face.name}</h3>
                <ManaCost cost={face.manaCost} />
              </header>

              <div className="type-line-row">
                <p
                  className="type-line"
                  title={face.typeLine}
                >
                  {abbreviateTypeLine(face.typeLine)}
                </p>

                <span
                  className={`set-rarity rarity-${card.rarity}`}
                  aria-label={`${card.set?.toUpperCase?.() ?? ''} ${
                    card.rarity ?? ''
                  }`}
                  title={`${card.set?.toUpperCase?.() ?? ''} • ${
                    card.rarity ?? ''
                  }`}
                >
                  <img
                    className="set-symbol"
                    src={setSymbolUrl(
                      card.set,
                      card.rarity,
                    )}
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
                  if (
                    event.key === 'Enter' ||
                    event.key === ' '
                  ) {
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
          </article>
        )
      })}
    </div>
  )
}