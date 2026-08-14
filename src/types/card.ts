export type CardColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'C'

export interface Card {
  id: string
  set: string
  rarity: 'common' | 'uncommon' | 'rare' | 'mythic'
  faces: Array<CardFace>
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
