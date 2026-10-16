import type { Category, Status, Task, TaskDraft } from '../domain/task'

/** Column internal names in the DayPlannerTasks list (docs/setup-microsoft.md). */
export interface TaskFields {
  Title: string
  TaskStart: string
  TaskEnd: string
  TaskOriginalEnd: string
  TaskActualStart?: string | null
  TaskActualEnd?: string | null
  TaskCategory: Category
  TaskStatus: Status
}

export interface GraphListItem {
  id: string
  fields: TaskFields
}

/**
 * SharePoint drops milliseconds ("…03:30:00Z"). Normalise to toISOString form so a
 * time read back equals the time written (nudge keys compare these strings).
 */
const normalise = (iso: string) => new Date(iso).toISOString()
const optional = (iso: string | null | undefined) => (iso ? normalise(iso) : undefined)

/** A draft becomes a planned item with originalEnd = end. Missing optionals are sent as null to clear them. */
export function toFields(t: Task | TaskDraft): TaskFields {
  const task: Omit<Task, 'id'> = 'id' in t ? t : { ...t, originalEnd: t.end, status: 'planned' }
  return {
    Title: task.title,
    TaskStart: task.start,
    TaskEnd: task.end,
    TaskOriginalEnd: task.originalEnd,
    TaskActualStart: task.actualStart ?? null,
    TaskActualEnd: task.actualEnd ?? null,
    TaskCategory: task.category,
    TaskStatus: task.status,
  }
}

export function fromItem(item: GraphListItem): Task {
  const f = item.fields
  const task: Task = {
    id: item.id,
    title: f.Title,
    start: normalise(f.TaskStart),
    end: normalise(f.TaskEnd),
    originalEnd: normalise(f.TaskOriginalEnd),
    category: f.TaskCategory,
    status: f.TaskStatus,
  }
  const actualStart = optional(f.TaskActualStart)
  const actualEnd = optional(f.TaskActualEnd)
  if (actualStart) task.actualStart = actualStart
  if (actualEnd) task.actualEnd = actualEnd
  return task
}
