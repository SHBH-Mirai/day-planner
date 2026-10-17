import type { Task, TaskDraft } from '../domain/task'
import { dayBounds } from '../domain/time'
import { fromItem, toFields, type GraphListItem } from './sharePointMapping'
import { RepositoryError, type TaskRepository } from './TaskRepository'

export type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

interface Options {
  siteId: string
  listId: string
  getToken: () => Promise<string>
  fetchFn?: FetchFn
  /** Give up on a request after this long, so one hung call can't block later saves. */
  timeoutMs?: number
}

const byStart = (a: Task, b: Task) => Date.parse(a.start) - Date.parse(b.start)

/** Saves tasks as items in a SharePoint list through Microsoft Graph. */
export class SharePointTaskRepository implements TaskRepository {
  private readonly base: string
  private readonly getToken: () => Promise<string>
  private readonly fetchFn: FetchFn
  private readonly timeoutMs: number

  constructor({ siteId, listId, getToken, fetchFn = (input, init) => fetch(input, init), timeoutMs = 30_000 }: Options) {
    this.base = `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items`
    this.getToken = getToken
    this.fetchFn = fetchFn
    this.timeoutMs = timeoutMs
  }

  async listForDay(day: Date): Promise<Task[]> {
    const { fromUtc, toUtc } = dayBounds(day)
    const filter = encodeURIComponent(`fields/TaskStart ge '${fromUtc}' and fields/TaskStart lt '${toUtc}'`)
    let url: string | undefined = `${this.base}?$expand=fields&$filter=${filter}`
    const tasks: Task[] = []
    while (url) {
      const page = (await (await this.request(url)).json()) as { value: GraphListItem[]; '@odata.nextLink'?: string }
      tasks.push(...page.value.map(fromItem))
      url = page['@odata.nextLink']
    }
    return tasks.sort(byStart)
  }

  async create(draft: TaskDraft): Promise<Task> {
    const res = await this.request(this.base, { method: 'POST', body: JSON.stringify({ fields: toFields(draft) }) })
    const { id } = (await res.json()) as { id: string }
    return { ...draft, id, originalEnd: draft.end, status: 'planned' }
  }

  async update(task: Task): Promise<Task> {
    await this.request(`${this.base}/${task.id}/fields`, { method: 'PATCH', body: JSON.stringify(toFields(task)) })
    return task
  }

  async remove(id: string): Promise<void> {
    await this.request(`${this.base}/${id}`, { method: 'DELETE' })
  }

  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.getToken()
    let res: Response
    try {
      res = await this.fetchFn(url, {
        ...init,
        signal: AbortSignal.timeout(this.timeoutMs),
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
  }
}
