import type { Card, LegalityStatus, MagicFormat } from '../../../../types/card'
import legalIcon from '../../../../assets/icons/legal.svg'
import bannedIcon from '../../../../assets/icons/banned.svg'
import notLegalIcon from '../../../../assets/icons/not-legal.svg'
import restrictedIcon from '../../../../assets/icons/restricted.svg'
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

export function CardLegalities({ card }: CardLegalitiesProps) {
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
      </div>
    </div>
  )
}
