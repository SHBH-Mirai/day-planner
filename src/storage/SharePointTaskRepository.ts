import type { Task, TaskDraft } from '../domain/task'
import { dayBounds } from '../domain/time'
import { fromItem, toFields, type GraphListItem } from './sharePointMapping'
import { graphList, type GraphList, type GraphListOptions } from './graphRequest'
import type { TaskRepository } from './TaskRepository'

export type { FetchFn } from './graphRequest'

const byStart = (a: Task, b: Task) => Date.parse(a.start) - Date.parse(b.start)

/** Saves tasks as items in a SharePoint list through Microsoft Graph. */
export class SharePointTaskRepository implements TaskRepository {
  private readonly list: GraphList
  private readonly base: string

  constructor(options: GraphListOptions) {
    this.list = graphList(options)
    this.base = this.list.items
  }

  private request(url: string, init?: RequestInit): Promise<Response> {
    return this.list.request(url, init)
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
}
