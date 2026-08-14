export type CardColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'C'

export interface Card {
  id: string
  set: string
  rarity: 'common' | 'uncommon' | 'rare' | 'mythic'
  faces: Array<CardFace>
  rullings: Array<Rulling>
}

export interface CardFace {
    name: string
    manaCost: string
    typeLine: string
    power?: string
    toughness?: string
    oracleText: string
    colors: CardColor[]
    imageUrl: string
    artCropUrl?: string
}

export interface Rulling {
    object: string
    oracle_id: string
    source: string
    published_at: string
    comment: string
}

