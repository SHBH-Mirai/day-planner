import { emptyPerCategory, type Category, type Status, type Task } from './task'
import { minutesBetween } from './time'
import { workPlannedMinutes, workSpentMinutes } from './fixed'

export interface TaskSummary {
  id: string
  title: string
  status: Status
  plannedMin: number
  /** null until the task has an actualEnd. */
  actualMin: number | null
}

export interface DaySummary {
  perTask: TaskSummary[]
  perCategory: Record<Category, number>
}

/** Planned length in minutes, never below 0. */
export function plannedMinutes(t: Task): number {
  return Math.max(0, minutesBetween(t.start, t.originalEnd))
}

/**
 * Minutes a task took: real time when Started was pressed, else its planned length,
 * since a task ticked done without Started has no real start to count from. Never below 0.
 */
export function spentMinutes(t: Task): number {
  return t.actualStart && t.actualEnd ? Math.max(0, minutesBetween(t.actualStart, t.actualEnd)) : plannedMinutes(t)
}

export function summarize(tasks: Task[]): DaySummary {
  const perCategory = emptyPerCategory()

  const perTask = tasks.map((t): TaskSummary => {
    // Working time: a fixed task (a call) inside a flexible one is a pause, not work.
    const plannedMin = workPlannedMinutes(t, tasks)
    const actualMin = t.actualEnd ? workSpentMinutes(t, tasks) : null

    if (t.status === 'done') perCategory[t.category] += actualMin ?? plannedMin
    else if (t.status === 'planned') perCategory[t.category] += plannedMin

    return { id: t.id, title: t.title, status: t.status, plannedMin, actualMin }
  })

  return { perTask, perCategory }
}
