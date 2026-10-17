import type { Routine, RoutineDraft } from '../domain/routine'
import { byStartTime, type RoutineRepository } from './RoutineRepository'
import { RepositoryError } from './TaskRepository'

/** Routines kept in memory (tests and memory mode). */
export class InMemoryRoutineRepository implements RoutineRepository {
  private readonly routines = new Map<string, Routine>()
  private nextId = 1

  async list(): Promise<Routine[]> {
    return [...this.routines.values()].map((r) => ({ ...r, days: [...r.days] })).sort(byStartTime)
  }

  async create(draft: RoutineDraft): Promise<Routine> {
    const routine = { ...draft, days: [...draft.days], id: `r${this.nextId++}` }
    this.routines.set(routine.id, routine)
    return { ...routine, days: [...routine.days] }
  }

  async update(routine: Routine): Promise<Routine> {
    if (!this.routines.has(routine.id)) throw new RepositoryError('notFound', 'Routine not found')
    this.routines.set(routine.id, { ...routine, days: [...routine.days] })
    return routine
  }

  async remove(id: string): Promise<void> {
    if (!this.routines.delete(id)) throw new RepositoryError('notFound', 'Routine not found')
  }
}
