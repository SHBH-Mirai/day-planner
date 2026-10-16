import type { Category, Status, Task } from './task'
import { minutesBetween } from './time'

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

export function summarize(tasks: Task[]): DaySummary {
  const perCategory: Record<Category, number> = { office: 0, freelance: 0, youtube: 0 }

  const perTask = tasks.map((t): TaskSummary => {
    const plannedMin = minutesBetween(t.start, t.originalEnd)
    const actualMin = t.actualEnd ? minutesBetween(t.actualStart ?? t.start, t.actualEnd) : null

    if (t.status === 'done') perCategory[t.category] += actualMin ?? plannedMin
    else if (t.status === 'planned') perCategory[t.category] += plannedMin

    return { id: t.id, title: t.title, status: t.status, plannedMin, actualMin }
  })

  return { perTask, perCategory }
}
