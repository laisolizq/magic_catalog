export type CardColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'C'

// Formats tracked by the card database (see generate_card_database.py's
// TRACKED_FORMATS); a card is only included if it is legal, restricted, or
// banned in at least one of these.
export type MagicFormat =
  | 'standard'
  | 'pioneer'
  | 'modern'
  | 'pauper'
  | 'legacy'
  | 'vintage'
  | 'commander'

export type LegalityStatus = 'legal' | 'not_legal' | 'restricted' | 'banned'

export type Legalities = Partial<Record<MagicFormat, LegalityStatus>>

export interface Card {
  id: string
  set: string
  setType?: string
  releasedAt?: string
  // Date the card was first seen in a generated database (approximates a
  // spoiler date, since Scryfall does not expose one).
  addedAt?: string
  collectorNumber?: string
  oracleId?: string
  rarity: 'common' | 'uncommon' | 'rare' | 'mythic'
  faces: Array<CardFace>
  // some data sources use the key 'rulings' (correct spelling)
  rulings?: Array<Ruling>
  legalities?: Legalities
}

export interface CardFace {
    name: string
    manaCost: string
    typeLine: string
    power?: string
    toughness?: string
    loyalty?: string
    oracleText: string
    colors: CardColor[]
    imageUrl: string
    artCropUrl?: string
}

export interface Ruling {
    object: string
    oracle_id: string
    source: string
    published_at: string
    comment: string
}

