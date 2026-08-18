// Parses/builds a Scryfall-like query syntax for the search bar, e.g.:
//   "dragon c:wu t:creature r:rare s:tla"
//
// Supported prefixes: c:/color:, t:/type:, r:/rarity:, s:/set:
// Everything else is treated as free text (name/oracle text search).
//
// This is a lightweight subset of Scryfall's syntax, not a full clone:
// - c: accepts letter combos (c:wu) or the words colorless/multicolor
// - t:/r:/s: accept a single word each (repeat the prefix for more values)
// - quoted phrases ("draw a card") are kept together as free text
// - negation (e.g. -t:creature) isn't supported; such tokens are treated
//   as free text so they don't silently do the wrong thing

export interface ParsedQuery {
  text: string
  colors: string[]
  types: string[]
  rarities: string[]
  sets: string[]
}

export interface QueryFilters {
  text: string
  colors: string[]
  types: string[]
  rarities: string[]
  sets: string[]
}

const COLOR_LETTERS: Record<string, string> = {
  w: 'W',
  u: 'U',
  b: 'B',
  r: 'R',
  g: 'G',
}

const COLOR_WORDS: Record<string, string> = {
  c: 'C',
  colorless: 'C',
  m: 'M',
  multi: 'M',
  multicolor: 'M',
  multicolour: 'M',
}

const TOKEN_REGEX = /[A-Za-z]+:"[^"]*"|[A-Za-z]+:\S+|"[^"]*"|\S+/g

const FIELD_ALIASES: Record<string, 'colors' | 'types' | 'rarities' | 'sets'> = {
  c: 'colors',
  color: 'colors',
  t: 'types',
  type: 'types',
  r: 'rarities',
  rarity: 'rarities',
  s: 'sets',
  set: 'sets',
}

function stripQuotes(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1)
  }

  return value
}

function parseColorValue(rawValue: string): string[] {
  const value = rawValue.toLowerCase()

  if (COLOR_WORDS[value]) return [COLOR_WORDS[value]]

  const colors: string[] = []

  for (const char of value) {
    const mapped = COLOR_LETTERS[char]

    if (mapped && !colors.includes(mapped)) {
      colors.push(mapped)
    }
  }

  return colors
}

function capitalize(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

export function parseScryfallQuery(input: string): ParsedQuery {
  const colors: string[] = []
  const types: string[] = []
  const rarities: string[] = []
  const sets: string[] = []
  const textWords: string[] = []

  const tokens = input.match(TOKEN_REGEX) ?? []

  for (const token of tokens) {
    const match = token.match(/^([A-Za-z]+):(.+)$/)

    if (match) {
      const field = FIELD_ALIASES[match[1].toLowerCase()]
      const rawValue = stripQuotes(match[2])

      if (field === 'colors') {
        parseColorValue(rawValue).forEach((color) => {
          if (!colors.includes(color)) colors.push(color)
        })
        continue
      }

      if (field === 'types') {
        const type = capitalize(rawValue)
        if (!types.includes(type)) types.push(type)
        continue
      }

      if (field === 'rarities') {
        const rarity = rawValue.toLowerCase()
        if (!rarities.includes(rarity)) rarities.push(rarity)
        continue
      }

      if (field === 'sets') {
        const set = rawValue.toLowerCase()
        if (!sets.includes(set)) sets.push(set)
        continue
      }
    }

    textWords.push(stripQuotes(token))
  }

  return {
    text: textWords.join(' '),
    colors,
    types,
    rarities,
    sets,
  }
}

function buildColorClauses(colors: string[]): string[] {
  const letters = colors
    .filter((color) => COLOR_LETTERS[color.toLowerCase()])
    .map((color) => color.toLowerCase())

  const words = colors.filter(
    (color) => !COLOR_LETTERS[color.toLowerCase()],
  )

  const clauses: string[] = []

  if (letters.length > 0) clauses.push(`c:${letters.join('')}`)

  words.forEach((color) => {
    if (color === 'C') clauses.push('c:colorless')
    if (color === 'M') clauses.push('c:multicolor')
  })

  return clauses
}

export function buildScryfallQuery(filters: QueryFilters): string {
  const parts = [filters.text.trim()]

  parts.push(...buildColorClauses(filters.colors))
  filters.types.forEach((type) => parts.push(`t:${type.toLowerCase()}`))
  filters.rarities.forEach((rarity) => parts.push(`r:${rarity}`))
  filters.sets.forEach((set) => parts.push(`s:${set}`))

  return parts.filter((part) => part.length > 0).join(' ')
}
