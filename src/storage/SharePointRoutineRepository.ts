import type { Routine, RoutineDraft } from '../domain/routine'
import { graphList, type GraphList, type GraphListOptions } from './graphRequest'
import { fromRoutineItem, toRoutineFields, type RoutineItem } from './routineMapping'
import { byStartTime, type RoutineRepository } from './RoutineRepository'

/** Routines as items in the SharePoint Templates list (the one the Morning flow reads). */
export class SharePointRoutineRepository implements RoutineRepository {
  private readonly graph: GraphList

  constructor(options: GraphListOptions) {
    this.graph = graphList(options)
  }

  async list(): Promise<Routine[]> {
    const routines: Routine[] = []
    let url: string | undefined = `${this.graph.items}?$expand=fields`
    while (url) {
      const page = (await (await this.graph.request(url)).json()) as { value: RoutineItem[]; '@odata.nextLink'?: string }
      routines.push(...page.value.map(fromRoutineItem))
      url = page['@odata.nextLink']
    }
    return routines.sort(byStartTime)
  }

  async create(draft: RoutineDraft): Promise<Routine> {
    const res = await this.graph.request(this.graph.items, { method: 'POST', body: JSON.stringify({ fields: toRoutineFields(draft) }) })
    const { id } = (await res.json()) as { id: string }
    return { ...draft, days: [...draft.days], id }
  }

  async update(routine: Routine): Promise<Routine> {
    const { id, ...draft } = routine
    await this.graph.request(`${this.graph.items}/${id}/fields`, { method: 'PATCH', body: JSON.stringify(toRoutineFields(draft, 'update')) })
    return routine
  }

  async setActive(id: string, active: boolean): Promise<void> {
    await this.graph.request(`${this.graph.items}/${id}/fields`, { method: 'PATCH', body: JSON.stringify({ Active: active }) })
  }

  async remove(id: string): Promise<void> {
    await this.graph.request(`${this.graph.items}/${id}`, { method: 'DELETE' })
  }
}
