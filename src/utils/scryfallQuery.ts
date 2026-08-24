// Parses/builds a Scryfall-like query syntax for the search bar, e.g.:
//   "dragon c=wu t:creature r:rare s:tla"
//   "dragon c>=wu"
//   "dragon c<=wu"
//   "dragon c>=2"
//   "dragon c!=1"
//
// Supported prefixes: c=/color=, t:/type:, r:/rarity:, s:/set:
//
// Color operators:
//   c=   -> exactly
//   c>=  -> including
//   c<=  -> at most
//
// Special color values:
//   colorless / C  -> colorless
//   multicolor / M -> multicolor
//   c>1             -> multicolor (kept for the Multicolor filter chip)
//
// Color count:
//   A plain number after c (with any of =, !=, >, <, >=, <=) filters by how
//   many colors a card has, e.g. c>=2, c<3, c!=1. This mirrors Scryfall's
//   own "compare against ranges of colors" syntax.
//
// Everything else is treated as free text (name/oracle text search).
//
// This is a lightweight subset of Scryfall's syntax, not a full clone:
// - c= matches colors exactly
// - c>= matches cards including all selected colors
// - c<= matches cards whose colors are a subset of the selected colors
// - c> matches cards with strictly more colors than the selected set (a
//   proper superset), e.g. c>UG; c<  is the proper-subset equivalent
// - c!= matches cards whose colors don't exactly equal the selected set
// - c>1 matches multicolor cards; c<N>, e.g. c>=2, filters by color count
// - t:/r:/s: accept a single word each (repeat the prefix for more values)
// - r: accepts Scryfall's rarity abbreviations (c/u/r/m) or full words, and
//   is always built back out using the abbreviation (e.g. r:u)
// - quoted phrases ("draw a card") are kept together as free text
// - negation (e.g. -t:creature) isn't supported; such tokens are treated
//   as free text so they don't silently do the wrong thing

export type ColorFilterMode =
  | 'exactly'
  | 'including'
  | 'atMost'
  | 'moreThan'
  | 'lessThan'
  | 'not'

export type ColorCountOperator =
  | '='
  | '!='
  | '>'
  | '<'
  | '>='
  | '<='

export interface ColorCountFilter {
  operator: ColorCountOperator
  value: number
}

export interface ParsedQuery {
  text: string
  colors: string[]
  colorMode: ColorFilterMode
  colorCount: ColorCountFilter | null
  types: string[]
  rarities: string[]
  sets: string[]
}

export interface QueryFilters {
  text: string
  colors: string[]
  colorMode?: ColorFilterMode
  colorCount?: ColorCountFilter | null
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
  multicolor: 'M',
}

const RARITY_ALIASES: Record<string, string> = {
  c: 'common',
  common: 'common',
  u: 'uncommon',
  uncommon: 'uncommon',
  r: 'rare',
  rare: 'rare',
  m: 'mythic',
  mythic: 'mythic',
}

const RARITY_ABBREVIATIONS: Record<string, string> = {
  common: 'c',
  uncommon: 'u',
  rare: 'r',
  mythic: 'm',
}

const TOKEN_REGEX =
  /[A-Za-z]+(?:>=|<=|!=|:|=|>|<)"[^"]*"|[A-Za-z]+(?:>=|<=|!=|:|=|>|<)\S+|"[^"]*"|\S+/g

const FIELD_ALIASES: Record<
  string,
  'colors' | 'types' | 'rarities' | 'sets'
> = {
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

  let colorMode: ColorFilterMode =
    'exactly'
  let colorCount: ColorCountFilter | null = null

  const textWords: string[] = []

  const tokens = input.match(TOKEN_REGEX) ?? []

  for (const token of tokens) {
    const match = token.match(/^([A-Za-z]+)(>=|<=|!=|:|=|>|<)(.+)$/)

    if (match) {
      const field = FIELD_ALIASES[match[1].toLowerCase()]
      const operator = match[2]
      const rawValue = stripQuotes(match[3])

      if (field === 'colors') {
        /*
         * Multicolor:
         *
         * c>1
         *
         * Kept as a special case (rather than falling into the generic
         * color-count branch below) so the Multicolor filter chip keeps
         * round-tripping through colors=['M'] instead of colorCount.
         */

        if (
          operator === '>' &&
          rawValue.trim() === '1'
        ) {
          if (!colors.includes('M')) {
            colors.push('M')
          }

          continue
        }

        /*
         * Color count:
         *
         * A plain number (c>=2, c<3, c!=1, ...) filters by how many
         * colors a card has, independently of the WUBRG/mode filter below.
         */

        if (/^\d+$/.test(rawValue.trim())) {
          const countOperator: ColorCountOperator =
            operator === ':' ? '=' : (operator as ColorCountOperator)

          colorCount = {
            operator: countOperator,
            value: Number(rawValue.trim()),
          }
          continue
        }

        /*
         * Color mode.
         *
         * c=   -> exactly
         * c>=  -> including
         * c<=  -> at most
         * c>   -> more than (proper superset)
         * c<   -> less than (proper subset)
         * c!=  -> not exactly
         *
         * The default is exactly.
         */

        if (operator === '=') {
          colorMode = 'exactly'
        } else if (operator === '>=') {
          colorMode = 'including'
        } else if (operator === '<=') {
          colorMode = 'atMost'
        } else if (operator === '>') {
          colorMode = 'moreThan'
        } else if (operator === '<') {
          colorMode = 'lessThan'
        } else if (operator === '!=') {
          colorMode = 'not'
        }

        parseColorValue(rawValue).forEach(
          (color) => {
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
        const lowered = rawValue.toLowerCase()
        const rarity = RARITY_ALIASES[lowered] ?? lowered
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
    colorMode,
    colorCount,
    types,
    rarities,
    sets,
  }
}

function buildColorClauses(
  colors: string[],
  colorMode: ColorFilterMode = 'exactly',
): string[] {
  const letters = colors
    .filter(
      (color) =>
        COLOR_LETTERS[
          color.toLowerCase()
        ],
    )
    .map((color) =>
      color.toLowerCase(),
    )

  const words = colors.filter(
    (color) =>
      !COLOR_LETTERS[
        color.toLowerCase()
      ],
  )

  const clauses: string[] = []

  /*
   * WUBRG colors
   *
   * exactly   -> c=wu
   * including -> c>=wu
   * atMost    -> c<=wu
   * moreThan  -> c>wu
   * lessThan  -> c<wu
   * not       -> c!=wu
   */

  if (letters.length > 0) {
    const operator =
      colorMode === 'including'
        ? '>='
        : colorMode === 'atMost'
          ? '<='
          : colorMode === 'moreThan'
            ? '>'
            : colorMode === 'lessThan'
              ? '<'
              : colorMode === 'not'
                ? '!='
                : '='

    clauses.push(
      `c${operator}${letters.join('')}`,
    )
  }

  /*
   * Special colors:
   *
   * C -> colorless
   * M -> multicolor
   *
   * These remain independent clauses, just as
   * they were before.
   */

  words.forEach((color) => {
    if (color === 'C') {
      clauses.push('c=colorless')
    }

    if (color === 'M') {
      clauses.push('c>1')
    }
  })

  return clauses
}

export function buildScryfallQuery(
  filters: QueryFilters,
): string {
  const parts = [
    filters.text.trim(),
  ]

  parts.push(
    ...buildColorClauses(
      filters.colors,
      filters.colorMode ??
        'exactly',
    ),
  )

  if (filters.colorCount) {
    parts.push(`c${filters.colorCount.operator}${filters.colorCount.value}`)
  }

  filters.types.forEach((type) => parts.push(`t:${type.toLowerCase()}`))
  filters.rarities.forEach((rarity) => {
    const lowered = rarity.toLowerCase()
    parts.push(`r:${RARITY_ABBREVIATIONS[lowered] ?? lowered}`)
  })
  filters.sets.forEach((set) => parts.push(`s:${set}`))

  return parts.filter((part) => part.length > 0).join(' ')
}
