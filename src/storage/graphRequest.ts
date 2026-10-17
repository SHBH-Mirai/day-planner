import { RepositoryError } from './TaskRepository'

export type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

/** What every SharePoint-list repository needs to talk to Microsoft Graph. */
export interface GraphListOptions {
  siteId: string
  listId: string
  getToken: () => Promise<string>
  fetchFn?: FetchFn
  /** Give up on a request after this long, so one hung call can't block later saves. */
  timeoutMs?: number
}

export interface GraphList {
  /** `…/sites/{site}/lists/{list}/items` */
  items: string
  request(url: string, init?: RequestInit): Promise<Response>
}

/** A Graph client for one SharePoint list: Bearer token, timeout, and errors mapped to RepositoryError. */
export function graphList({ siteId, listId, getToken, fetchFn = (input, init) => fetch(input, init), timeoutMs = 30_000 }: GraphListOptions): GraphList {
  return {
    items: `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items`,
    async request(url, init = {}) {
      const token = await getToken()
      let res: Response
      try {
        res = await fetchFn(url, {
          ...init,
          signal: AbortSignal.timeout(timeoutMs),
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            // GUESS: lets the date filter run even if TaskStart isn't indexed yet.
            Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly',
          },
        })
      } catch (error) {
        throw new RepositoryError('network', error instanceof Error ? error.message : 'Network error')
      }
      if (res.ok) return res
      if (res.status === 401 || res.status === 403) throw new RepositoryError('auth', `Graph ${res.status}`)
      if (res.status === 404) throw new RepositoryError('notFound', 'Item not found')
      throw new RepositoryError('unknown', `Graph ${res.status}`)
    },
  }
}
