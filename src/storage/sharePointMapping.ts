import { readCategory, type Category, type Status, type Task, type TaskDraft } from '../domain/task'

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
  /** Multiple lines of text, plain. Sent as null to clear it. */
  TaskDescription?: string | null
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

/**
 * A draft becomes a planned item with originalEnd = end. Missing optionals are sent as null to clear them.
 * A new item sends a description only when it has one; an update always sends it, so clearing works.
 */
export function toFields(t: Task | TaskDraft): TaskFields {
  const isUpdate = 'id' in t
  const task: Omit<Task, 'id'> = isUpdate ? t : { ...t, originalEnd: t.end, status: 'planned' }
  const fields: TaskFields = {
    Title: task.title,
    TaskStart: task.start,
    TaskEnd: task.end,
    TaskOriginalEnd: task.originalEnd,
    TaskActualStart: task.actualStart ?? null,
    TaskActualEnd: task.actualEnd ?? null,
    TaskCategory: task.category,
    TaskStatus: task.status,
  }
  if (isUpdate || task.description) fields.TaskDescription = task.description ?? null
  return fields
}

export function fromItem(item: GraphListItem): Task {
  const f = item.fields
  const task: Task = {
    id: item.id,
    title: f.Title,
    start: normalise(f.TaskStart),
    end: normalise(f.TaskEnd),
    originalEnd: normalise(f.TaskOriginalEnd),
    category: readCategory(f.TaskCategory),
    status: f.TaskStatus,
  }
  const actualStart = optional(f.TaskActualStart)
  const actualEnd = optional(f.TaskActualEnd)
  if (actualStart) task.actualStart = actualStart
  if (actualEnd) task.actualEnd = actualEnd
  if (typeof f.TaskDescription === 'string' && f.TaskDescription.trim()) task.description = f.TaskDescription
  return task
}
