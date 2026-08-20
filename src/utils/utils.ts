
const symbolAssets = import.meta.glob<string>(
  '../assets/symbols/**/*.{svg,png}',
  { eager: true, import: 'default', query: '?url' },
)

export function parseSymbols(cost: string): string[] {
  return Array.from(cost.matchAll(/\{([^}]+)\}/g), (m) => m[1])
}

const symbols: Record<string, string> = Object.fromEntries(
  Object.entries(symbolAssets).map(([path, url]) => [
    path.split('/').pop()?.replace(/\.(svg|png)$/, ''),
    url,
  ]),
)

const symbolAliases: Record<string, string> = {
  '½': 'HALF',
  '∞': 'INFINITY',
}

export function symbolUrl(sym: string): string {
  const filename = symbolAliases[sym] ?? sym.replace(/\//g, '')
  return symbols[filename] ?? symbols[filename.toLowerCase()]
}
