import type { FetchFn } from '../storage/graphRequest'

export interface FakeRequest {
  method: string
  url: string
  body?: Record<string, unknown>
}

/**
 * An in-memory stand-in for Graph's SharePoint list items API, enough for the settings and
 * routine repositories: GET items (with fields), POST, PATCH /fields, DELETE.
 * Like Graph, `@odata.type` annotations are accepted on write and not returned on read.
 */
export function fakeListGraph() {
  const lists = new Map<string, Map<string, Record<string, unknown>>>()
  const requests: FakeRequest[] = []
  let nextId = 1

  const json = (status: number, body?: unknown) =>
    new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  const clean = (fields: Record<string, unknown>) => Object.fromEntries(Object.entries(fields).filter(([k]) => !k.includes('@odata')))
  const list = (id: string) => {
    if (!lists.has(id)) lists.set(id, new Map())
    return lists.get(id)!
  }

  const fetchFn: FetchFn = async (input, init) => {
    const url = decodeURIComponent(String(input))
    const method = init?.method ?? 'GET'
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined
    requests.push({ method, url, body })

    const listId = url.match(/\/lists\/([^/]+)\/items/)?.[1]
    if (!listId) return json(400)
    const items = list(listId)
    const itemId = url.match(/\/items\/([^/?]+)/)?.[1]

    if (method === 'GET') return json(200, { value: [...items].map(([id, fields]) => ({ id, fields: { ...fields } })) })
    if (method === 'POST') {
      const id = String(nextId++)
      items.set(id, clean((body?.fields as Record<string, unknown>) ?? {}))
      return json(201, { id, fields: items.get(id) })
    }
    if (!itemId || !items.has(itemId)) return json(404)
    if (method === 'PATCH') {
      items.set(itemId, { ...items.get(itemId), ...clean(body ?? {}) })
      return json(200, items.get(itemId))
    }
    if (method === 'DELETE') {
      items.delete(itemId)
      return json(204)
    }
    return json(405)
  }

  return {
    fetchFn,
    requests,
    /** Seed an item directly, as if it already existed in SharePoint. */
    seed(listId: string, fields: Record<string, unknown>): string {
      const id = String(nextId++)
      list(listId).set(id, fields)
      return id
    },
    items: (listId: string) => [...list(listId)].map(([id, fields]) => ({ id, fields })),
  }
}
