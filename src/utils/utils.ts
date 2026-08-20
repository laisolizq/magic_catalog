
import W from '../assets/symbols/colors/W.svg'
import U from '../assets/symbols/colors/U.svg'
import B from '../assets/symbols/colors/B.svg'
import R from '../assets/symbols/colors/R.svg'
import G from '../assets/symbols/colors/G.svg'
import M from '../assets/symbols/colors/M.svg'
import C from '../assets/symbols/colors/C.svg'
import Artifact from '../assets/symbols/types/artifact.svg'
import Creature from '../assets/symbols/types/creature.svg'
import Enchantment from '../assets/symbols/types/enchantment.svg'
import Instant from '../assets/symbols/types/instant.svg'
import Land from '../assets/symbols/types/land.svg'
import Planeswalker from '../assets/symbols/types/planeswalker.png'
import Sorcery from '../assets/symbols/types/sorcery.svg'

export function parseSymbols(cost: string): string[] {
  return Array.from(cost.matchAll(/\{([^}]+)\}/g), (m) => m[1])
}

const symbols: Record<string, string> = {
  W,
  U,
  B,
  R,
  G,
  M,
  C,
  Artifact,
  Creature,
  Enchantment,
  Instant,
  Land,
  Planeswalker,
  Sorcery,
}

export function symbolUrl(sym: string): string {
  return symbols[sym]
}
