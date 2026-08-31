export type CardColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'C'

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

