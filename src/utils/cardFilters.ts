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
     * ['W', 'U']
     * -> White OR Blue
     */

    const colors = cardColors(card)

    const matchesColor =
      filters.color.length === 0 ||
      filters.color.includes('all') ||
      filters.color.some((color) =>
        colors.includes(color),
      )

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

export function getUniqueTypes(
  cards: Card[],
): string[] {
  return [
    ...new Set(
      cards.map((card) =>
        cardPrimaryTypeLine(card).split(' ')[0],
      ),
    ),
  ].sort()
}