import './ManaCost.css'
import { parseSymbols, symbolUrl } from '../../../../../../../../utils/utils.ts'

interface ManaCostProps {
  cost: string
}

export function ManaCost({ cost }: ManaCostProps) {
  if (!cost) return <span className="mana-cost-empty">—</span>

  const symbols = parseSymbols(cost)

  return (
    <span className="mana-cost-row" aria-label={`Mana cost: ${cost}`}>
      {symbols.map((sym, i) => (
        <img
          key={i}
          className="mana-symbol"
          src={symbolUrl(sym)}
          alt={sym}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}
