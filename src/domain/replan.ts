import { fixedBlocks, flowAround, workMinutes } from './flow'
import { relay } from './push'
import { isMovable } from './reorder'
import type { Task } from './task'
import { formatLocalTime } from './time'

const STEP_MS = 5 * 60_000

/**
 * Re-plan the day: every planned, not-started, flexible task lies back to back from `startMs`, in the
 * day's order, each keeping its working time and pausing for fixed tasks. Overdue tasks come to the
 * start, gaps and overlaps go. Returns the tasks that changed.
 */
export function replanDay(day: Task[], startMs: number): Task[] {
  const order = day
    .filter(isMovable)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start) || day.indexOf(a) - day.indexOf(b))
  const blocks = fixedBlocks(day)
  let cursor = startMs
  const laid = order.map((t) => {
    const { start, end } = flowAround(cursor, workMinutes(t, blocks), blocks)
    cursor = end
    return relay(t, start, end)
  })
  return laid.filter((t) => {
    const old = day.find((o) => o.id === t.id)!
    return old.start !== t.start || old.end !== t.end
  })
}

/** Today's re-plan starts now (rounded up to 5 minutes), or when the running task is due to end. */
export function replanStart(day: Task[], now: Date): number {
  const from = Math.ceil(now.getTime() / STEP_MS) * STEP_MS
  const running = day.filter((t) => t.status === 'planned' && t.actualStart && !t.actualEnd).map((t) => Date.parse(t.end))
  return Math.max(from, ...running)
}

/** Tomorrow's re-plan starts at the first task that can move; undefined when none can. */
export function firstStart(day: Task[]): number | undefined {
  const starts = day.filter(isMovable).map((t) => Date.parse(t.start))
  return starts.length ? Math.min(...starts) : undefined
}

/** The Undo bar's line: "Re-planned 5 tasks from 14:00". */
export function describeReplan(changed: Task[], startMs: number): string {
  const n = changed.length
  return `Re-planned ${n} task${n === 1 ? '' : 's'} from ${formatLocalTime(new Date(startMs).toISOString())}`
}
