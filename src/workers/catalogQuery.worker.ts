/// <reference lib="webworker" />

import { queryCardsOnCurrentThread } from '../services/sqliteCardQuery'
import type { CatalogQuery, CatalogQueryResult } from '../types/catalog'

interface QueryRequest {
  id: number
  type: 'query'
  query: CatalogQuery
}

interface QueryResponse {
  id: number
  type: 'result' | 'error'
  result?: CatalogQueryResult
  error?: string
}

self.onmessage = async (event: MessageEvent<QueryRequest>) => {
  const request = event.data
  if (request.type !== 'query') return

  try {
    const result = await queryCardsOnCurrentThread(request.query)
    const response: QueryResponse = { id: request.id, type: 'result', result }
    self.postMessage(response)
  } catch (error) {
    const response: QueryResponse = {
      id: request.id,
      type: 'error',
      error: error instanceof Error ? error.message : 'Catalog query failed.',
    }
    self.postMessage(response)
  }
}