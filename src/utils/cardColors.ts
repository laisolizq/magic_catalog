import type { CardColor } from '../types/card'

export function cardColorsMatchFace(
  colors: CardColor[],
  selectedColors: string[],
): boolean {
  const selectedWubrg = selectedColors.filter((color) => color !== 'C' && color !== 'M')

  return (
    (selectedColors.includes('C') && colors.length === 0) ||
    (selectedColors.includes('M') && colors.length > 1) ||
    (selectedWubrg.length > 0 &&
      colors.length === selectedWubrg.length &&
      selectedWubrg.every((color) => colors.includes(color as CardColor)))
  )
}
