import { fixedBlocks, flowAround, workMinutes } from './flow'
import { relay } from './push'
import { isMovable } from './reorder'
import type { Task } from './task'
import { formatLocalTime } from './time'

const STEP_MS = 5 * 60_000

/**
 * Re-plan the day: every planned, not-started, flexible task lies back to back from `startMs`, in the
 * day's order, each keeping its working time and pausing for fixed tasks. Overdue tasks come to the
 * start, gaps and overlaps go. A task that would end after `endMs` (midnight) and every one after it
 * stay where they are and are counted in `leftOver`. `from` is where the first task lands.
 */
export function replanPlan(day: Task[], startMs: number, endMs = Infinity): { changed: Task[]; from: number; leftOver: number } {
  const order = day
    .filter(isMovable)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start) || day.indexOf(a) - day.indexOf(b))
  const blocks = fixedBlocks(day)
  let cursor = startMs
  const laid: Task[] = []
  for (const t of order) {
    const { start, end } = flowAround(cursor, workMinutes(t, blocks), blocks)
    if (end > endMs) break
    laid.push(relay(t, start, end))
    cursor = end
  }
  const changed = laid.filter((t, i) => order[i].start !== t.start || order[i].end !== t.end)
  const from = laid.length ? Date.parse(laid[0].start) : startMs
  return { changed, from, leftOver: order.length - laid.length }
}

/** The tasks a re-plan from `startMs` changes (no end-of-day limit). */
export function replanDay(day: Task[], startMs: number): Task[] {
  return replanPlan(day, startMs).changed
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

/** The Undo bar's line: "Re-planned 5 tasks from 14:00", plus how many didn't fit before midnight. */
export function describeReplan(moved: number, fromMs: number, leftOver: number): string {
  const head = `Re-planned ${moved} task${moved === 1 ? '' : 's'} from ${formatLocalTime(new Date(fromMs).toISOString())}`
  return leftOver ? `${head} · ${leftOver} ${leftOver === 1 ? "doesn't" : "don't"} fit before midnight` : head
}
