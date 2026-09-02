import type { Card } from '../../types/card'

function getFaceName(card: Card): string {
  return card.faces[0]?.name ?? ''
}

function collectorSortKey(value: string | undefined): [number, string] {
  const match = value?.match(/^(\d+)(.*)$/)
  if (!match) return [Number.MAX_SAFE_INTEGER, value ?? '']
  return [Number(match[1]), match[2].toLowerCase()]
}

// Ordered most -> least preferred. A card's default printing is picked from
// whichever tier it has any printing in, highest first (a core/expansion
// printing always wins over any other set type): the latest release within
// the core/expansion tier, or the earliest release for any other tier.
const SET_TYPE_TIERS: readonly (readonly string[])[] = [
  ['core', 'expansion'],
]

function tierIndexForSetType(setType: string | undefined): number {
  const index = SET_TYPE_TIERS.findIndex(
    (setTypes) => setType != null && setTypes.includes(setType),
  )
  return index === -1 ? SET_TYPE_TIERS.length : index
}

function comparePrintingPreference(
  left: Card,
  right: Card,
  preferOldest: boolean,
): number {
  // Release date only distinguishes *different* sets (e.g. picking the
  // newer/older of two reprint sets). Within the same set, some products
  // (like LTR's later Holiday-release variants) reuse the set code with a
  // later release date purely for the reprint batch, so falling through to
  // release date here would wrongly prefer those over the original numbering.
  if (left.set !== right.set) {
    // Promo sets (e.g. PMH2) are sometimes released *before* their parent set
    // (prerelease promos), so a plain release-date comparison would wrongly
    // treat the promo as the original printing. Always prefer the non-promo
    // printing (e.g. MH2) regardless of preferOldest or release date.
    const leftIsPromo = left.setType === 'promo'
    const rightIsPromo = right.setType === 'promo'
    if (leftIsPromo !== rightIsPromo) return leftIsPromo ? -1 : 1

    const releaseDelta = (left.releasedAt ?? '').localeCompare(right.releasedAt ?? '')
    if (releaseDelta !== 0) return preferOldest ? -releaseDelta : releaseDelta

    const setDelta = left.set.localeCompare(right.set)
    if (setDelta !== 0) return setDelta
  }

  const [leftNumber, leftSuffix] = collectorSortKey(left.collectorNumber)
  const [rightNumber, rightSuffix] = collectorSortKey(right.collectorNumber)
  return (
    rightNumber - leftNumber ||
    rightSuffix.localeCompare(leftSuffix) ||
    right.id.localeCompare(left.id)
  )
}

export function selectLatestPrintings(cards: Card[]): Card[] {
  const latestByName = new Map<string, Card>()
  const cardsByName = new Map<string, Card[]>()

  cards.forEach((card) => {
    const name = getFaceName(card)
    const printings = cardsByName.get(name) ?? []
    printings.push(card)
    cardsByName.set(name, printings)
  })

  cardsByName.forEach((printings, name) => {
    const bestTierIndex = Math.min(
      ...printings.map((card) => tierIndexForSetType(card.setType)),
    )
    const candidates = printings.filter(
      (card) => tierIndexForSetType(card.setType) === bestTierIndex,
    )
    // Core/expansion (tier 0) prefers the newest set; every other set type
    // prefers the oldest, so the original printing wins over later reprints.
    const preferOldest = bestTierIndex !== 0

    const preferred = candidates.slice(1).reduce<Card>((current, card) => {
      return comparePrintingPreference(card, current, preferOldest) > 0
        ? card
        : current
    }, candidates[0])

    latestByName.set(name, preferred)
  })

  return cards.filter((card) => latestByName.get(getFaceName(card)) === card)
}
