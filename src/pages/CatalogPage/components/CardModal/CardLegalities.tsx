import { useState } from 'react'
import type { Card, LegalityStatus, MagicFormat } from '../../../../types/card'
import './CardLegalities.css'

interface CardLegalitiesProps {
  card: Card
}

const FORMAT_LABELS: Record<MagicFormat, string> = {
  standard: 'Standard',
  pioneer: 'Pioneer',
  modern: 'Modern',
  pauper: 'Pauper',
  legacy: 'Legacy',
  vintage: 'Vintage',
  commander: 'Commander',
}

const LEGALITY_CLASS: Record<LegalityStatus, string> = {
  legal: 'legal',
  not_legal: 'not-legal',
  restricted: 'restricted',
  banned: 'banned',
}

const LEGALITY_LABEL: Record<LegalityStatus, string> = {
  legal: 'Legal',
  not_legal: 'Not Legal',
  restricted: 'Restricted',
  banned: 'Banned',
}

export function CardLegalities({ card }: CardLegalitiesProps) {
  const [setIconFailed, setSetIconFailed] = useState(false)
  const legalities = card.legalities
  if (!legalities) return null

  const formats: Array<{ format: MagicFormat; label: string; status: LegalityStatus }> = []

  ;(Object.entries(FORMAT_LABELS) as Array<[MagicFormat, string]>).forEach(([format, label]) => {
    const status = legalities[format]
    if (status) {
      formats.push({ format, label, status })
    }
  })

  if (formats.length === 0) return null

  return (
    <div className="card-legalities">
      <div className="legalities-grid">
        {formats.map(({ label, status }) => (
          <div
            key={label}
            className={`legality-item`}
            title={`${label}: ${LEGALITY_LABEL[status]}`}
          >
            <div className={`legality-icon legality-${LEGALITY_CLASS[status]}`} />
            <div className="legality-format-name">{label}</div>
          </div>
        ))}
        <div className="legality-item" title={`Set: ${card.set.toUpperCase()}`}>
          {setIconFailed ? (
            <div className="legality-set-icon legality-set-icon-placeholder" />
          ) : (
            <img
              className="legality-set-icon"
              src={`https://svgs.scryfall.io/sets/${card.set.toLowerCase()}.svg`}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setSetIconFailed(true)}
            />
          )}
          <div className="legality-format-name">{card.set.toUpperCase()}</div>
        </div>
      </div>
    </div>
  )
}
