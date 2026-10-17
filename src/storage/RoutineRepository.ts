import type { Routine, RoutineDraft } from '../domain/routine'

/** Where routines (the Templates list) are kept. */
export interface RoutineRepository {
  /** All routines, sorted by start time. */
  list(): Promise<Routine[]>
  create(draft: RoutineDraft): Promise<Routine>
  update(routine: Routine): Promise<Routine>
  /** Pause or resume, touching nothing else on the row. */
  setActive(id: string, active: boolean): Promise<void>
  /** In SharePoint this sends the item to the recycle bin. */
  remove(id: string): Promise<void>
}

export const byStartTime = (a: Routine, b: Routine) => a.startTime.localeCompare(b.startTime)
