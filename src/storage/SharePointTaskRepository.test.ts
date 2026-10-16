import { describe, expect, test, vi } from 'vitest'
import { SharePointTaskRepository, type FetchFn } from './SharePointTaskRepository'
import { runRepositoryContract } from './repositoryContract'

const SITE = 'contoso.sharepoint.com,1,2'
const LIST = 'list-1'
const BASE = `https://graph.microsoft.com/v1.0/sites/${SITE}/lists/${LIST}/items`
const DAY = new Date('2026-10-17T12:00:00+05:30')

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** Pretends to be Graph: stores items, applies the TaskStart filter, returns times without milliseconds. */
function fakeGraph(): FetchFn {
  const items = new Map<string, Record<string, unknown>>()
  let nextId = 1
  const strip = (fields: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, typeof v === 'string' ? v.replace('.000Z', 'Z') : v]))

  return async (input, init) => {
    const url = decodeURIComponent(String(input))
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    const id = url.match(/\/items\/([^/?]+)/)?.[1]

    if (method === 'GET') {
      const [, from, to] = url.match(/TaskStart ge '([^']+)' and fields\/TaskStart lt '([^']+)'/) ?? []
      const value = [...items.entries()]
        .filter(([, f]) => String(f.TaskStart) >= from.replace('.000Z', 'Z') && String(f.TaskStart) < to.replace('.000Z', 'Z'))
        .map(([itemId, fields]) => ({ id: itemId, fields }))
      return json(200, { value })
    }
    if (method === 'POST') {
      const newId = String(nextId++)
      items.set(newId, strip(body.fields))
      return json(201, { id: newId })
    }
    if (!id || !items.has(id)) return json(404, { error: { code: 'itemNotFound' } })
    if (method === 'PATCH') {
      items.set(id, { ...items.get(id), ...strip(body) })
      return json(200, items.get(id))
    }
    items.delete(id)
    return json(204)
  }
}

const repoWith = (fetchFn: FetchFn) =>
  new SharePointTaskRepository({ siteId: SITE, listId: LIST, getToken: async () => 'tok', fetchFn })

runRepositoryContract('SharePointTaskRepository', () => repoWith(fakeGraph()))

describe('SharePointTaskRepository requests', () => {
  test('listForDay filters on TaskStart for the local day, with a Bearer token', async () => {
    const fetchFn = vi.fn<FetchFn>(async () => json(200, { value: [] }))
    await repoWith(fetchFn).listForDay(DAY)
    const [url, init] = fetchFn.mock.calls[0]
    expect(decodeURIComponent(String(url))).toBe(
      `${BASE}?$expand=fields&$filter=fields/TaskStart ge '2026-10-16T18:30:00.000Z' and fields/TaskStart lt '2026-10-17T18:30:00.000Z'`,
    )
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer tok')
  })

  test('follows @odata.nextLink pages', async () => {
    const item = (id: string, hh: string) => ({
      id,
      fields: {
        Title: id, TaskStart: `2026-10-17T${hh}:00:00Z`, TaskEnd: `2026-10-17T${hh}:30:00Z`,
        TaskOriginalEnd: `2026-10-17T${hh}:30:00Z`, TaskCategory: 'office', TaskStatus: 'planned',
      },
    })
    const fetchFn = vi
      .fn<FetchFn>()
      .mockResolvedValueOnce(json(200, { value: [item('a', '05')], '@odata.nextLink': `${BASE}?page=2` }))
      .mockResolvedValueOnce(json(200, { value: [item('b', '04')] }))
    const tasks = await repoWith(fetchFn).listForDay(DAY)
    expect(String(fetchFn.mock.calls[1][0])).toBe(`${BASE}?page=2`)
    expect(tasks.map((t) => t.id)).toEqual(['b', 'a'])
  })

  test('401 and 403 become auth errors', async () => {
    await expect(repoWith(async () => json(401)).listForDay(DAY)).rejects.toMatchObject({ kind: 'auth' })
    await expect(repoWith(async () => json(403)).listForDay(DAY)).rejects.toMatchObject({ kind: 'auth' })
  })

  test('a fetch that throws becomes a network error', async () => {
    const offline: FetchFn = async () => {
      throw new TypeError('Failed to fetch')
    }
    await expect(repoWith(offline).listForDay(DAY)).rejects.toMatchObject({ kind: 'network' })
  })

  test('500 becomes an unknown error', async () => {
    await expect(repoWith(async () => json(500)).listForDay(DAY)).rejects.toMatchObject({ kind: 'unknown' })
  })
})
