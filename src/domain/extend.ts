import type { Task } from './task'

const MINUTE_MS = 60_000
/** Up to this late, "+15" still counts from the planned end (normal nudge delay). */
const LATE_GRACE_MS = 5 * MINUTE_MS

/**
 * Give a task `minutes` more, counted from its end, or from `now` (to the minute) when
 * more than 5 minutes late (a late "+15" means 15 more minutes from now). `affected` = other
 * still-planned tasks that started at or after the old end but now begin before the new end.
 */
export function extendTask(task: Task, minutes: number, all: Task[], now?: Date): { updated: Task; affected: Task[] } {
  const oldEnd = Date.parse(task.end)
  const nowMs = now?.getTime() ?? oldEnd
  const base = nowMs - oldEnd > LATE_GRACE_MS ? Math.floor(nowMs / MINUTE_MS) * MINUTE_MS : oldEnd
  const newEnd = base + minutes * MINUTE_MS
  const updated: Task = { ...task, end: new Date(newEnd).toISOString() }

  const affected = all
    .filter((t) => t.id !== task.id && t.status === 'planned')
    .filter((t) => Date.parse(t.start) >= oldEnd && Date.parse(t.start) < newEnd)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))

  return { updated, affected }
}
