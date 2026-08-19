import type { Card } from '../types/card'

export interface CardFilters {
  query: string
  set: string[]
  type: string[]
  rarity: string[]
  color: string[]
}

function cardSearchText(card: Card): string {
  const faceTexts = (card.faces || []).map((f) =>
    [f.name, f.typeLine, f.oracleText, f.manaCost].join(' '),
  )

  return faceTexts.join(' ').toLowerCase()
}

function cardPrimaryTypeLine(card: Card): string {
  return card.faces && card.faces[0]
    ? card.faces[0].typeLine
    : ''
}

function cardColors(card: Card): string[] {
  const colors = new Set<string>()

  ;(card.faces || []).forEach((f) => {
    ;(f.colors || []).forEach((c) => colors.add(c))
  })

  return Array.from(colors)
}

export function filterCards(
  cards: Card[],
  filters: CardFilters,
): Card[] {
  const query = filters.query.trim().toLowerCase()

  return cards.filter((card) => {
    /*
     * =========================
     * QUERY
     * =========================
     */

    const text = cardSearchText(card)

    const matchesQuery =
      query.length === 0 || text.includes(query)

    /*
     * =========================
     * SET
     * =========================
     *
     * Multiple sets = OR
     *
     * []       -> no set filter
     * ['all']   -> no set filter
     * ['tla']   -> TLA
     * ['tla','fin'] -> TLA OR FIN
     */

    const matchesSet =
      filters.set.length === 0 ||
      filters.set.includes('all') ||
      filters.set.includes(card.set)

    /*
     * =========================
     * TYPE
     * =========================
     *
     * Multiple types = OR
     *
     * ['Creature', 'Artifact']
     * -> Creature OR Artifact
     */

    const typeLine =
      cardPrimaryTypeLine(card).toLowerCase()

    const matchesType =
      filters.type.length === 0 ||
      filters.type.includes('all') ||
      filters.type.some((type) =>
        typeLine.includes(type.toLowerCase()),
      )

    /*
     * =========================
     * RARITY
     * =========================
     *
     * ['rare', 'mythic']
     * -> rare OR mythic
     */

    const matchesRarity =
      filters.rarity.length === 0 ||
      filters.rarity.includes('all') ||
      filters.rarity.includes(card.rarity)

    /*
     * =========================
     * COLOR
     * =========================
     *
     * C and M are matched independently, but WUBRG letters are matched as
     * a single group requiring an exact color identity (like Scryfall's
     * c= operator):
     *
     * ['W']      -> exactly White
     * ['W', 'U'] -> exactly White+Blue (not White OR Blue)
     * ['C', 'W'] -> Colorless OR exactly White
     */

    const colors = cardColors(card)
    const wubrgSelected = filters.color.filter(
      (color) => color !== 'C' && color !== 'M',
    )

    const matchesColor =
      filters.color.length === 0 ||
      filters.color.includes('all') ||
      (filters.color.includes('C') && colors.length === 0) ||
      (filters.color.includes('M') && colors.length > 1) ||
      (wubrgSelected.length > 0 &&
        colors.length === wubrgSelected.length &&
        wubrgSelected.every((color) => colors.includes(color)))

    /*
     * =========================
     * FINAL RESULT
     * =========================
     *
     * Different filter categories use AND.
     *
     * Example:
     *
     * COLOR: W + U
     * RARITY: rare + mythic
     *
     * means:
     *
     * (W OR U) AND (rare OR mythic)
     */

    return (
      matchesQuery &&
      matchesSet &&
      matchesType &&
      matchesRarity &&
      matchesColor
    )
  })
}

export function getUniqueSets(
  cards: Card[],
): string[] {
  return [
    ...new Set(cards.map((card) => card.set)),
  ].sort()
}

// Supertypes that shouldn't be treated as a selectable card type on their own
// (e.g. "Legendary Planeswalker" should surface "Planeswalker", not "Legendary").
const SUPERTYPES = new Set(['Legendary', 'Basic', 'Snow', 'World', 'Ongoing'])

function cardMainTypes(card: Card): string[] {
  const typeLine = cardPrimaryTypeLine(card)
  const typesPart = typeLine.split('\u2014')[0].trim()

  return typesPart
    .split(' ')
    .filter((word) => word.length > 0 && !SUPERTYPES.has(word))
}

export function getUniqueTypes(cards: Card[]): string[] {
  const types = new Set<string>()

  cards.forEach((card) => {
    cardMainTypes(card).forEach((type) => types.add(type))
  })

  return [...types].sort()
}