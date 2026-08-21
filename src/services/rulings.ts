import { getCatalogDatabase } from '../db/sqliteClient'
import type { Ruling } from '../types/card'

export async function getCardRulings(
  oracleId: string | undefined,
): Promise<Ruling[]> {
  if (!oracleId) return []

  const database = await getCatalogDatabase()
  if (!database) return []

  const result = database.exec(
    'SELECT object, oracle_id, source, published_at, comment FROM rulings WHERE oracle_id = $oracleId ORDER BY published_at',
    { '$oracleId': oracleId },
  )

  return (result[0]?.values ?? []).map((row) => ({
    object: String(row[0]),
    oracle_id: String(row[1]),
    source: String(row[2]),
    published_at: String(row[3]),
    comment: String(row[4]),
  }))
}
