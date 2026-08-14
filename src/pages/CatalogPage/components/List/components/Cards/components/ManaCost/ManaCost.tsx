import './ManaCost.css'

interface ManaCostProps {
  cost: string
}

function parseSymbols(cost: string): string[] {
  return Array.from(cost.matchAll(/\{([^}]+)\}/g), (m) => m[1])
}

// Scryfall hosts an SVG for every mana symbol at this URL pattern.
// Hybrid symbols (e.g. "W/U", "2/W", "B/G/P") drop the slashes in the filename.
function symbolUrl(sym: string): string {
  return `https://svgs.scryfall.io/card-symbols/${sym.replace(/\//g, '')}.svg`
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
