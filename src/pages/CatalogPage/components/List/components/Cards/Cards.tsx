import { useState } from 'react'
import type { Card, CardFace } from '../../../../../../types/card'
import { symbolUrl } from '../../../../../../utils/utils'
import { ManaCost } from './components/ManaCost/ManaCost'
import './Cards.css'

// Query results (name, type, oracle text) are ready long before the art
// image (an external Scryfall fetch) finishes loading - show a shimmering
// placeholder in its place instead of a blank/static frame until it does.
function CardThumb({
  src,
  alt,
  onOpenDetails,
}: {
  src: string
  alt: string
  onOpenDetails: () => void
}) {
  const [isLoaded, setIsLoaded] = useState(false)

  return (
    <>
      {!isLoaded && (
        <div className="card-thumb-placeholder" aria-hidden="true" />
      )}

      <img
        className={`card-thumb ${isLoaded ? 'is-loaded' : ''}`}
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        onClick={(event) => {
          event.stopPropagation()
          onOpenDetails()
        }}
      />
    </>
  )
}

interface CardsProps {
  card: Card
  isOracleExpanded: boolean
  onToggleOracle: (cardId: string) => void
  onOpenDetails: (card: Card, faceIndex?: number) => void
  quantity?: number
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

// Falls back to the set code letters when Scryfall has no symbol for the set
// (e.g. very new or non-standard sets) instead of a broken image icon.
function SetSymbol({
  setCode,
  rarity,
}: {
  setCode: string
  rarity: Card['rarity']
}) {
  const [hasError, setHasError] = useState(false)

  if (hasError) {
    return (
      <span className="set-symbol set-symbol-fallback" aria-hidden="true">
        {setCode.toUpperCase()}
      </span>
    )
  }

  return (
    <img
      className="set-symbol"
      src={setSymbolUrl(setCode, rarity)}
      alt=""
      aria-hidden="true"
      loading="lazy"
      onError={() => setHasError(true)}
    />
  )
}

// Set code is hidden until tapped, since hover tooltips aren't reachable on
// touch devices; tapping toggles the code without opening the card modal.
function SetBadge({
  setCode,
  rarity,
}: {
  setCode: string
  rarity: Card['rarity']
}) {
  const [codeVisible, setCodeVisible] = useState(false)

  return (
    <span
      className={`set-rarity rarity-${rarity}`}
      aria-label={`${setCode?.toUpperCase?.() ?? ''} ${rarity ?? ''}`}
      title={`${setCode?.toUpperCase?.() ?? ''} • ${rarity ?? ''}`}
      onClick={(event) => {
        event.stopPropagation()
        setCodeVisible((v) => !v)
      }}
    >
      <SetSymbol setCode={setCode} rarity={rarity} />
      {codeVisible && (
        <span className="set-code-label" aria-hidden="true">
          {setCode?.toUpperCase?.() ?? ''}
        </span>
      )}
    </span>
  )
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
  quantity,
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
                  <CardThumb
                    src={getFaceImage(face)}
                    alt={face.name}
                    onOpenDetails={() => onOpenDetails(card, faceIndex)}
                  />

                  {Boolean(quantity) && (
                    <span className="deck-quantity-badge">{quantity}x</span>
                  )}

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

                <SetBadge setCode={card.set} rarity={card.rarity} />
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