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

  it('prefers the oldest printing within the best available tier when it is not core/expansion (e.g. Ragavan)', () => {
    // Ragavan only exists in draft_innovation sets: mh2 (2021) and its
    // h2r Timeshifts reprint (2024). Both share a tier, so the original
    // (oldest) printing wins.
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

    expect(result).toEqual([mh2])
  })

  it('prefers the oldest printing among non-core/expansion set types (e.g. Kappa Cannoneer)', () => {
    // Kappa Cannoneer debuted in Neon Dynasty Commander (2022, commander),
    // was later printed in Modern Horizons 3 (2024, draft_innovation), and
    // also reprinted in a newer commander deck (2025). With only a single
    // "everything else" tier below core/expansion, the original (oldest)
    // release wins.
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

    expect(result).toEqual([neonDynastyCommander])
  })

  it('prefers the original collector number over a same-set later-dated reprint (e.g. LTR Holiday release)', () => {
    // LTR's Holiday release reuses the 'ltr' set code for reprints of cards
    // that already exist in the June 2023 printing, just with a later
    // releasedAt and a much higher collector number. The original numbering
    // should still be treated as the default printing.
    const original = makeCard({
      id: 'ltr-original',
      set: 'ltr',
      setType: 'draft_innovation',
      collectorNumber: '10',
      releasedAt: '2023-06-23',
    })
    const holidayReprint = makeCard({
      id: 'ltr-holiday',
      set: 'ltr',
      setType: 'draft_innovation',
      collectorNumber: '461',
      releasedAt: '2023-11-03',
    })

    const result = selectLatestPrintings([original, holidayReprint])

    expect(result).toEqual([original])
  })

  it('prefers the parent set over its promo printing even when the promo released earlier (e.g. Fury in MH2 vs prerelease PMH2)', () => {
    const mh2 = makeCard({
      id: 'mh2-fury',
      set: 'mh2',
      setType: 'draft_innovation',
      releasedAt: '2021-06-18',
    })
    const pmh2 = makeCard({
      id: 'pmh2-fury',
      set: 'pmh2',
      setType: 'promo',
      releasedAt: '2021-05-06',
    })

    expect(selectLatestPrintings([mh2, pmh2])).toEqual([mh2])
    expect(selectLatestPrintings([pmh2, mh2])).toEqual([mh2])
  })
})
