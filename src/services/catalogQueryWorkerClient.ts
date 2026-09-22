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

interface QueryWaiter {
  resolve: (result: CatalogQueryResult) => void
  reject: (error: Error) => void
}

interface QueuedQuery {
  query: CatalogQuery
  waiters: QueryWaiter[]
}

let worker: Worker | null = null
let nextRequestId = 1
let activeRequest: { id: number; waiters: QueryWaiter[] } | null = null
let queuedQuery: QueuedQuery | null = null

function rejectPending(error: Error) {
  activeRequest?.waiters.forEach(({ reject }) => reject(error))
  queuedQuery?.waiters.forEach(({ reject }) => reject(error))
  activeRequest = null
  queuedQuery = null
}

function getWorker(): Worker {
  if (worker) return worker

  worker = new Worker(
    new URL('../workers/catalogQuery.worker.ts', import.meta.url),
    { type: 'module' },
  )
  worker.onmessage = (event: MessageEvent<QueryResponse>) => {
    const response = event.data
    if (!activeRequest || response.id !== activeRequest.id) return

    const completedRequest = activeRequest
    activeRequest = null
    if (response.type === 'result' && response.result) {
      completedRequest.waiters.forEach(({ resolve }) => resolve(response.result!))
    } else {
      const error = new Error(response.error ?? 'Catalog query worker failed.')
      completedRequest.waiters.forEach(({ reject }) => reject(error))
    }

    runNextQuery()
  }
  worker.onerror = (event) => {
    rejectPending(new Error(event.message || 'Catalog query worker failed.'))
    worker?.terminate()
    worker = null
  }

  return worker
}

function runNextQuery() {
  if (activeRequest || !queuedQuery) return

  const nextQuery = queuedQuery
  queuedQuery = null
  const id = nextRequestId++
  activeRequest = { id, waiters: nextQuery.waiters }
  const request: QueryRequest = { id, type: 'query', query: nextQuery.query }
  getWorker().postMessage(request)
}

export function queryCardsInWorker(query: CatalogQuery): Promise<CatalogQueryResult> {
  return new Promise((resolve, reject) => {
    const waiter = { resolve, reject }
    if (queuedQuery) {
      queuedQuery.query = query
      queuedQuery.waiters.push(waiter)
    } else {
      queuedQuery = { query, waiters: [waiter] }
    }
    runNextQuery()
  })
}

export function invalidateCatalogQueryWorker() {
  if (!worker) return

  worker.terminate()
  worker = null
  rejectPending(new Error('Catalog database changed during a query.'))
}