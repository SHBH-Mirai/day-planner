import { fixedBlocks, flowAround, toWork, workMinutes } from './flow'
import { relay, shiftChain } from './push'
import type { Task } from './task'
import { formatLocalTime } from './time'

/** Only planned, not-started, flexible tasks can be dragged or moved by a reorder. */
export const isMovable = (t: Task) => t.status === 'planned' && !t.actualStart && !t.fixed

/** The movable tasks in the day's order (by start, then list order). */
function movableOrder(day: Task[]): Task[] {
  return day.filter(isMovable).sort((a, b) => Date.parse(a.start) - Date.parse(b.start) || day.indexOf(a) - day.indexOf(b))
}

/**
 * Put `movedId` before `beforeId` (any task in the day; null = the end) and return every task
 * that changed. The moved task and the ones it passes are laid back to back from the earliest of
 * their starts, each keeping its working time and pausing for fixed tasks. If that segment now
 * ends later, the later movable tasks it overlaps move by the working time it gained.
 */
export function reorderDay(day: Task[], movedId: string, beforeId: string | null): Task[] {
  const order = movableOrder(day)
  const from = order.findIndex((t) => t.id === movedId)
  if (from < 0 || beforeId === movedId) return []
  const moved = order[from]
  const rest = order.filter((t) => t.id !== movedId)
  let to = rest.length
  if (beforeId !== null) {
    const before = day.find((t) => t.id === beforeId)
    if (!before) return []
    const at = Date.parse(before.start)
    const bi = day.indexOf(before)
    to = rest.filter((t) => Date.parse(t.start) < at || (Date.parse(t.start) === at && day.indexOf(t) < bi)).length
  }
  if (to === from) return []

  const next = [...rest.slice(0, to), moved, ...rest.slice(to)]
  const [lo, hi] = [Math.min(from, to), Math.max(from, to)]
  const segment = next.slice(lo, hi + 1)
  const blocks = fixedBlocks(day)
  const oldEnd = Math.max(...segment.map((t) => Date.parse(t.end)))

  let cursor = Math.min(...segment.map((t) => Date.parse(t.start)))
  const laid = segment.map((t) => {
    const { start, end } = flowAround(cursor, workMinutes(t, blocks), blocks)
    cursor = end
    return relay(t, start, end)
  })
  const gained = toWork(cursor, blocks) - toWork(oldEnd, blocks)
  const later = gained > 0 ? shiftChain(next.slice(hi + 1), cursor, gained, blocks) : []

  const changed = (t: Task) => {
    const old = day.find((o) => o.id === t.id)
    return !old || old.start !== t.start || old.end !== t.end
  }
  return [...laid, ...later].filter(changed)
}

/** Where Move up (-1) or Move down (+1) puts a task: the `beforeId` for reorderDay, or undefined when it can't move. */
export function moveTarget(day: Task[], id: string, step: -1 | 1): string | null | undefined {
  const order = movableOrder(day)
  const i = order.findIndex((t) => t.id === id)
  if (i < 0) return undefined
  if (step === -1) return i > 0 ? order[i - 1].id : undefined
  if (i >= order.length - 1) return undefined
  return order[i + 2]?.id ?? null
}

/** The gap the pointer is nearest to: 0 = above the first row, rows.length = below the last. */
export function dropIndex(pointerY: number, rows: { top: number; height: number }[]): number {
  const i = rows.findIndex((r) => pointerY < r.top + r.height / 2)
  return i < 0 ? rows.length : i
}

/** The Undo bar's line after a reorder: "Moved B to 16:00 · A now 16:30 · 2 more". */
export function describeReorder(changed: Task[]): string {
  const [first, second, ...more] = changed
  if (!first) return 'Nothing moved.'
  const parts = [`Moved ${first.title} to ${formatLocalTime(first.start)}`]
  if (second) parts.push(`${second.title} now ${formatLocalTime(second.start)}`)
  if (more.length) parts.push(`${more.length} more`)
  return parts.join(' · ')
}
