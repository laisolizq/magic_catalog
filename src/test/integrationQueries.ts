import type { CatalogQuery } from '../types/catalog'

export interface IntegrationQueryCase {
  name: string
  filters: CatalogQuery
}

const BASE: CatalogQuery = {
  text: '',
  sets: [],
  types: [],
  rarities: [],
  colors: [],
  colorMode: 'exactly',
}

/**
 * Representative shapes of the most frequent user searches, derived from the
 * SearchBar's basic filters and the query syntax in utils/scryfallQuery.ts.
 * Note: queryCards' SQLite path always matches colors exactly regardless of
 * colorMode (it's only interpreted by the client-side cardFilters.ts path).
 */
export const INTEGRATION_QUERY_CASES: IntegrationQueryCase[] = [
  {
    name: 'free text name search',
    filters: { ...BASE, text: 'dragon' },
  },
  {
    // The SQLite-backed free-text search only indexes card face names, not oracle text.
    name: 'free text partial name search',
    filters: { ...BASE, text: 'bolt' },
  },
  {
    name: 'free text partial name search uro',
    filters: { ...BASE, text: 'uro' },
  },
  {
    name: 'single set filter',
    filters: { ...BASE, sets: ['znr'] },
  },
  {
    name: 'type filter only (creature)',
    filters: { ...BASE, types: ['Creature'] },
  },
  {
    name: 'rarity filter only (rare)',
    filters: { ...BASE, rarities: ['rare'] },
  },
  {
    name: 'color filter (mono red)',
    filters: { ...BASE, colors: ['R'] },
  },
  {
    name: 'color filter (exact WU pair)',
    filters: { ...BASE, colors: ['W', 'U'] },
  },
  {
    name: 'multicolor filter',
    filters: { ...BASE, colors: ['M'] },
  },
  {
    name: 'colorless filter',
    filters: { ...BASE, colors: ['C'] },
  },
  {
    name: 'combined text + type + color + rarity',
    filters: {
      ...BASE,
      text: 'dragon',
      types: ['Creature'],
      colors: ['R'],
      rarities: ['rare'],
    },
  },
  {
    name: 'browse all (no filters)',
    filters: { ...BASE },
  },
]
