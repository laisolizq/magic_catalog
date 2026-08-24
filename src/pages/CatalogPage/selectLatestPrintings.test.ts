import { describe, expect, it } from 'vitest'

import type { Card } from '../../types/card'
import { selectLatestPrintings } from './selectLatestPrintings'

function makeCard(overrides: Partial<Card> & { id: string }): Card {
  return {
    set: 'xxx',
    rarity: 'mythic',
    faces: [{
      name: 'Test Card',
      manaCost: '{R}',
      typeLine: 'Creature — Monkey Pirate',
      oracleText: '',
      colors: ['R'],
      imageUrl: '',
    }],
    ...overrides,
  }
}

describe('selectLatestPrintings', () => {
  it('prefers the newest core/expansion printing when one exists', () => {
    const original = makeCard({
      id: 'expansion-old',
      set: 'old',
      setType: 'expansion',
      releasedAt: '2020-01-01',
    })
    const newerExpansion = makeCard({
      id: 'expansion-new',
      set: 'new',
      setType: 'expansion',
      releasedAt: '2023-01-01',
    })
    const nonMajorReprint = makeCard({
      id: 'masters-newest',
      set: 'mst',
      setType: 'masters',
      releasedAt: '2024-01-01',
    })

    const result = selectLatestPrintings([original, newerExpansion, nonMajorReprint])

    expect(result).toEqual([newerExpansion])
  })

  it('prefers the latest printing within the best available tier (e.g. Ragavan)', () => {
    // Ragavan only exists in draft_innovation sets: mh2 (2021) and its
    // h2r Timeshifts reprint (2024). Both share a tier, so the newest wins.
    const mh2 = makeCard({
      id: 'h2r-mh2',
      set: 'mh2',
      setType: 'draft_innovation',
      releasedAt: '2021-06-18',
    })
    const h2r = makeCard({
      id: 'h2r-timeshift',
      set: 'h2r',
      setType: 'draft_innovation',
      releasedAt: '2024-06-14',
    })

    const result = selectLatestPrintings([mh2, h2r])

    expect(result).toEqual([h2r])
  })

  it('prefers a draft_innovation printing over commander-deck printings, regardless of release date (e.g. Kappa Cannoneer)', () => {
    // Kappa Cannoneer debuted in Neon Dynasty Commander (2022, commander),
    // was later printed in Modern Horizons 3 (2024, draft_innovation), and
    // also reprinted in newer commander decks (2024/2025). mh3 should win.
    const neonDynastyCommander = makeCard({
      id: 'nec',
      set: 'nec',
      setType: 'commander',
      releasedAt: '2022-02-18',
    })
    const modernHorizons3 = makeCard({
      id: 'mh3',
      set: 'mh3',
      setType: 'draft_innovation',
      releasedAt: '2024-06-14',
    })
    const karlovManorCommander = makeCard({
      id: 'mkc',
      set: 'mkc',
      setType: 'commander',
      releasedAt: '2024-02-09',
    })
    const edgeOfEternitiesCommander = makeCard({
      id: 'eoc',
      set: 'eoc',
      setType: 'commander',
      releasedAt: '2025-08-01',
    })

    const result = selectLatestPrintings([
      neonDynastyCommander,
      modernHorizons3,
      karlovManorCommander,
      edgeOfEternitiesCommander,
    ])

    expect(result).toEqual([modernHorizons3])
  })
})
