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
// whichever tier it has any printing in, highest first (e.g. a mh3/commander
// split like Kappa Cannoneer prefers the draft_innovation/mh3 one over any
// commander-deck printing, regardless of release date), then the latest
// release within that tier.
const SET_TYPE_TIERS: readonly (readonly string[])[] = [
  ['core', 'expansion'],
  ['draft_innovation'],
  ['masters'],
  ['commander'],
  ['starter'],
  ['eternal'],
]

function tierIndexForSetType(setType: string | undefined): number {
  const index = SET_TYPE_TIERS.findIndex(
    (setTypes) => setType != null && setTypes.includes(setType),
  )
  return index === -1 ? SET_TYPE_TIERS.length : index
}

function comparePrintingPreference(left: Card, right: Card): number {
  const releaseDelta = (left.releasedAt ?? '').localeCompare(right.releasedAt ?? '')
  if (releaseDelta !== 0) return releaseDelta

  const setDelta = left.set.localeCompare(right.set)
  if (setDelta !== 0) return setDelta

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

    const preferred = candidates.slice(1).reduce<Card>((current, card) => {
      return comparePrintingPreference(card, current) > 0
        ? card
        : current
    }, candidates[0])

    latestByName.set(name, preferred)
  })

  return cards.filter((card) => latestByName.get(getFaceName(card)) === card)
}
