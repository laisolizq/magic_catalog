export type CardColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'C'

export interface Card {
  id: string
  name: string
  manaCost: string
  typeLine: string
  power?: string
  toughness?: string
  oracleText: string
  set: string
  rarity: 'common' | 'uncommon' | 'rare' | 'mythic'
  colors: CardColor[]
  imageUrl: string
  artCropUrl?: string
}
