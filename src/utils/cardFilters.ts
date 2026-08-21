import type { Card } from '../types/card'

export type ColorFilterMode =
  | 'exactly'
  | 'including'
  | 'atMost'

export interface CardFilters {
  query: string
  set: string[]
  type: string[]
  rarity: string[]
  color: string[]
  colorMode?: ColorFilterMode
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

/*
 * =========================
 * COLOR
 * =========================
 *
 * WUBRG are real colors.
 *
 * C = colorless
 *     -> a card with no colors
 *
 * M = multicolor
 *     -> a card with more than one color
 *
 * The three modes reproduce the behavior of Scryfall's
 * color search:
 *
 * exactly:
 *   selected colors must be exactly the card's colors
 *
 * including:
 *   the card must contain every selected color,
 *   but may contain additional colors
 *
 * atMost:
 *   every card color must be among the selected colors.
 *   Colorless cards are therefore included automatically,
 *   because [] is a subset of every color set.
 */

function matchesColorFilter(
  colors: string[],
  selectedColors: string[],
  mode: ColorFilterMode,
): boolean {
  if (selectedColors.length === 0) {
    return true
  }

  const selectedWubrg = selectedColors.filter(
    (color) => !['C', 'M'].includes(color),
  )

  const selectedColorless = selectedColors.includes('C')
  const selectedMulticolor = selectedColors.includes('M')

  const isColorless = colors.length === 0
  const isMulticolor = colors.length > 1

  /*
   * C and M are special filters rather than actual colors.
   *
   * We first determine whether they independently match.
   */

  const matchesColorless =
    selectedColorless && isColorless

  const matchesMulticolor =
    selectedMulticolor && isMulticolor

  /*
   * If C or M is selected together with WUBRG,
   * they behave as additional OR conditions.
   *
   * Example:
   *
   * W + C
   * -> white cards OR colorless cards
   */

  if (mode === 'exactly') {
    const matchesExactWubrg =
      selectedWubrg.length > 0 &&
      colors.length === selectedWubrg.length &&
      selectedWubrg.every((color) =>
        colors.includes(color),
      )

    return (
      matchesExactWubrg ||
      matchesColorless ||
      matchesMulticolor
    )
  }

  if (mode === 'including') {
    const matchesIncludingWubrg =
      selectedWubrg.length > 0 &&
      selectedWubrg.every((color) =>
        colors.includes(color),
      )

    return (
      matchesIncludingWubrg ||
      matchesColorless ||
      matchesMulticolor
    )
  }

  /*
   * AT MOST
   *
   * This is the important special case:
   *
   * Colorless cards must match automatically when using
   * WUBRG colors, because an empty color set is a subset
   * of the selected colors.
   *
   * Example:
   *
   * W + U
   *
   * matches:
   *   []
   *   [W]
   *   [U]
   *   [W,U]
   *
   * but NOT:
   *   [B]
   *   [W,B]
   *   [W,U,B]
   */

  if (mode === 'atMost') {
    if (isColorless) {
      return (
        selectedColorless ||
        selectedWubrg.length > 0
      )
    }

    if (
      selectedMulticolor &&
      isMulticolor
    ) {
      return true
    }

    if (selectedWubrg.length === 0) {
      return false
    }

    return colors.every((color) =>
      selectedWubrg.includes(color),
    )
  }

  return false
}

export function filterCards(
  cards: Card[],
  filters: CardFilters,
): Card[] {
  const query = filters.query.trim().toLowerCase()

  /*
   * Keep the existing behavior if colorMode isn't provided.
   *
   * This also means existing CardFilters objects won't
   * immediately break while we update the parent component.
   */
  const colorMode: ColorFilterMode =
    filters.colorMode ?? 'exactly'

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
     * Multiple rarities = OR
     */

    const matchesRarity =
      filters.rarity.length === 0 ||
      filters.rarity.includes('all') ||
      filters.rarity.includes(card.rarity)

    /*
     * =========================
     * COLOR
     * =========================
     */

    const colors = cardColors(card)

    const matchesColor =
      filters.color.length === 0 ||
      filters.color.includes('all') ||
      matchesColorFilter(
        colors,
        filters.color,
        colorMode,
      )

    /*
     * =========================
     * FINAL RESULT
     * =========================
     *
     * Different filter categories use AND.
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