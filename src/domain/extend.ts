import type { Task } from './task'

const MINUTE_MS = 60_000

/**
 * Push a task's end back by `minutes`. `affected` = other still-planned tasks
 * that started at or after the old end but now begin before the new end.
 */
export function extendTask(task: Task, minutes: number, all: Task[]): { updated: Task; affected: Task[] } {
  const oldEnd = Date.parse(task.end)
  const newEnd = oldEnd + minutes * MINUTE_MS
  const updated: Task = { ...task, end: new Date(newEnd).toISOString() }

  const affected = all
    .filter((t) => t.id !== task.id && t.status === 'planned')
    .filter((t) => Date.parse(t.start) >= oldEnd && Date.parse(t.start) < newEnd)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))

  return { updated, affected }
}
