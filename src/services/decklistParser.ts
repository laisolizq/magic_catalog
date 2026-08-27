import { findCardPrintings } from './sqliteCardQuery'
import type { DeckCardEntry, UnresolvedDeckLine } from '../types/deck'

export interface ParsedDecklistLine {
  quantity: number
  name: string
  setCode?: string
  collectorNumber?: string
  raw: string
}

// Matches "4 Lightning Bolt", "4x Lightning Bolt", and the Arena-style
// "4 Lightning Bolt (STA) 42" printing-pin suffix.
const LINE_PATTERN = /^(\d+)x?\s+(.+?)(?:\s*\(([A-Za-z0-9]+)\)\s*(\S+))?$/

export function parseDecklistLines(text: string): ParsedDecklistLine[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((raw) => {
      const match = raw.match(LINE_PATTERN)
      if (!match) return { quantity: 1, name: raw, raw }

      const [, quantity, name, setCode, collectorNumber] = match
      return {
        quantity: Number(quantity),
        name: name.trim(),
        setCode: setCode?.toLowerCase(),
        collectorNumber,
        raw,
      }
    })
}

export interface ResolvedDecklist {
  cards: DeckCardEntry[]
  unresolvedLines: UnresolvedDeckLine[]
}

export async function resolveDecklistLines(
  parsedLines: ParsedDecklistLine[],
): Promise<ResolvedDecklist> {
  const cards: DeckCardEntry[] = []
  const unresolvedLines: UnresolvedDeckLine[] = []

  for (const line of parsedLines) {
    const printings = await findCardPrintings(line.name)

    if (printings.length === 0) {
      unresolvedLines.push({ rawLine: line.raw, reason: 'No matching card' })
      continue
    }

    const pinnedPrinting = line.setCode
      ? printings.find(
          (card) =>
            card.set.toLowerCase() === line.setCode &&
            card.collectorNumber === line.collectorNumber,
        )
      : undefined

    const chosenPrinting = pinnedPrinting ?? printings[0]

    cards.push({
      cardId: chosenPrinting.id,
      quantity: line.quantity,
      rawName: line.name,
    })
  }

  return { cards, unresolvedLines }
}
