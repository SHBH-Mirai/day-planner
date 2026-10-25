import { DESCRIPTION_TOO_LONG, descriptionTooLong, type Category, type Task, type TaskDraft } from './task'

export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'
/** In SharePoint's order, Monday first; values match the Templates list's Days choices. */
export const WEEKDAYS: readonly Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** A recurring task. The 06:00 Morning flow turns active routines into tasks on their days. */
export interface Routine {
  id: string
  title: string
  category: Category
  /** 24-hour local time, "HH:mm". */
  startTime: string
  durationMin: number
  days: Weekday[]
  active: boolean
  /** Copied into each day's task. */
  description?: string
  /** The day's task is fixed time. */
  fixed?: boolean
}

export type RoutineDraft = Omit<Routine, 'id'>

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/

/** Messages for what's wrong with a routine; empty when it's fine. */
export function validateRoutine(r: RoutineDraft): string[] {
  const errors: string[] = []
  if (!r.title.trim()) errors.push('Add a title')
  if (!HH_MM.test(r.startTime)) errors.push('Use a time like 07:15')
  if (!(r.durationMin >= 5 && r.durationMin <= 720)) errors.push('Length must be 5 to 720 minutes')
  if (r.days.length === 0) errors.push('Pick at least one day')
  if (descriptionTooLong(r.description)) errors.push(DESCRIPTION_TOO_LONG)
  return errors
}

/** The routine as a task on `day`, starting at its local time. */
export function routineToDraft(r: Routine, day: Date): TaskDraft {
  const [h, m] = r.startTime.split(':').map(Number)
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m)
  const end = new Date(start.getTime() + r.durationMin * 60_000)
  const draft: TaskDraft = { title: r.title, start: start.toISOString(), end: end.toISOString(), category: r.category }
  if (r.description) draft.description = r.description
  if (r.fixed) draft.fixed = true
  return draft
}

/** Already on that day? Same rule as the Morning flow: a task with the same title and start. */
export function isOnDay(r: Routine, day: Date, tasks: Task[]): boolean {
  const { title, start } = routineToDraft(r, day)
  return tasks.some((t) => t.title === title && Date.parse(t.start) === Date.parse(start))
}
