import { useState } from 'react'

import type { Card, LegalityStatus, MagicFormat } from '../../../../types/card'
import legalIcon from '../../../../assets/icons/legal.svg'
import bannedIcon from '../../../../assets/icons/banned.svg'
import notLegalIcon from '../../../../assets/icons/not-legal.svg'
import restrictedIcon from '../../../../assets/icons/restricted.svg'
import infoIcon from '../../../../assets/icons/info.svg'
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

const LEGALITY_ICON: Record<LegalityStatus, string> = {
  legal: legalIcon,
  not_legal: notLegalIcon,
  restricted: restrictedIcon,
  banned: bannedIcon,
}

const LEGALITY_LABEL: Record<LegalityStatus, string> = {
  legal: 'Legal',
  not_legal: 'Not Legal',
  restricted: 'Restricted',
  banned: 'Banned',
}

const LEGALITY_DESCRIPTION: Record<LegalityStatus, string> = {
  legal: 'This card can be played in this format.',
  not_legal: 'This card is not legal in this format.',
  restricted: 'Only one copy of this card is allowed in a deck for this format.',
  banned: 'This card is banned and cannot be played in this format.',
}

const LEGALITY_ORDER: LegalityStatus[] = ['legal', 'restricted', 'banned', 'not_legal']

export function CardLegalities({ card }: CardLegalitiesProps) {
  const [legendOpen, setLegendOpen] = useState(false)
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
            <img className="legality-icon" src={LEGALITY_ICON[status]} alt="" />
            <div className="legality-format-name">{label}</div>
          </div>
        ))}

        <div
          className="legality-legend-trigger"
          role="button"
          tabIndex={0}
          onClick={() => setLegendOpen((open) => !open)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setLegendOpen((open) => !open)
            }
          }}
          aria-expanded={legendOpen}
          aria-label="Toggle legality icon legend"
          title="Toggle legality icon legend"
        >
          <img className="legality-icon" src={infoIcon} alt="" />
        </div>
      </div>

      {legendOpen && (
        <div className="legality-legend">
          {LEGALITY_ORDER.map((status) => (
            <div key={status} className="legality-legend-item">
              <img className="legality-icon" src={LEGALITY_ICON[status]} alt="" />
              <div>
                <div className="legality-legend-label">{LEGALITY_LABEL[status]}</div>
                <div className="legality-legend-description">
                  {LEGALITY_DESCRIPTION[status]}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
