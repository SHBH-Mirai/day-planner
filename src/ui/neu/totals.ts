import { plannedMinutes, spentMinutes } from '../../domain/summary'
import type { Category, Task } from '../../domain/task'

export interface DayTotals {
  /** Planned minutes of every task that isn't skipped. */
  planned: number
  /** Minutes spent on done tasks: real time when Started was pressed, else the planned length. */
  done: number
  doneCount: number
  skippedCount: number
  /** Done tasks at their spent time, planned tasks at their planned length; skipped left out. */
  perCategory: Record<Category, number>
}

/**
 * One set of day numbers for the focus strip and the summary, so the two screens agree.
 * A task ticked done without Started has no real start, so its planned length is the honest guess.
 */
export function dayTotals(tasks: Task[]): DayTotals {
  const totals: DayTotals = { planned: 0, done: 0, doneCount: 0, skippedCount: 0, perCategory: { office: 0, freelance: 0, youtube: 0 } }

  for (const t of tasks) {
    if (t.status === 'skipped') {
      totals.skippedCount++
      continue
    }
    const plannedMin = plannedMinutes(t)
    totals.planned += plannedMin
    if (t.status === 'done') {
      const spent = spentMinutes(t)
      totals.doneCount++
      totals.done += spent
      totals.perCategory[t.category] += spent
    } else {
      totals.perCategory[t.category] += plannedMin
    }
  }
  return totals
}
