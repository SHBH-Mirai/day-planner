import { extendTask } from './extend'
import type { Task } from './task'
import { formatLocalTime } from './time'

/** How much one push gives a task, in minutes. */
export const PUSH_MIN = 30

const MINUTE_MS = 60_000
const shift = (iso: string, ms: number) => new Date(Date.parse(iso) + ms).toISOString()

/**
 * The other tasks that move when `before` becomes `after`, already shifted.
 * Only a later end pushes: still-planned tasks from the old end on move by the same amount
 * while they overlap the chain; the first one clear of it stops the walk. Done, skipped and
 * started tasks never move. Moving earlier or shortening never pulls anything back.
 */
export function pushChain(before: Task, after: Task, all: Task[]): Task[] {
  const oldEnd = Date.parse(before.end)
  const delta = Date.parse(after.end) - oldEnd
  if (delta <= 0) return []

  const candidates = all
    .filter((t) => t.id !== before.id && t.status === 'planned' && !t.actualStart && Date.parse(t.start) >= oldEnd)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))

  const moved: Task[] = []
  let frontier = Date.parse(after.end)
  for (const t of candidates) {
    if (Date.parse(t.start) >= frontier) break
    const next = { ...t, start: shift(t.start, delta), end: shift(t.end, delta), originalEnd: shift(t.originalEnd, delta) }
    moved.push(next)
    frontier = Math.max(frontier, Date.parse(next.end))
  }
  return moved
}

/** +30 on a task: it runs on (an overrun, so originalEnd stays) and the chain behind it moves. */
export function pushTask(task: Task, all: Task[], now: Date): { updated: Task; moved: Task[]; deltaMin: number } {
  const { updated } = extendTask(task, PUSH_MIN, all, now)
  const deltaMin = Math.round((Date.parse(updated.end) - Date.parse(task.end)) / MINUTE_MS)
  return { updated, moved: pushChain(task, updated, all), deltaMin }
}

/** The Undo bar's line after a push or a later re-plan. */
export function describePush(title: string, newEnd: string, moved: Task[], deltaMin: number): string {
  const rest = moved.length ? `Moved ${moved.map((t) => t.title).join(', ')} by ${deltaMin} min.` : 'Nothing else moves.'
  return `${title}: ends at ${formatLocalTime(newEnd)}. ${rest}`
}
