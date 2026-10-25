import { extendTask } from './extend'
import { type Block, fixedBlocks, flowAround, toWall, toWork, workMinutes } from './flow'
import type { Task } from './task'
import { formatLocalTime } from './time'

/** How much one push gives a task, in minutes. */
export const PUSH_MIN = 30

const MINUTE_MS = 60_000
const iso = (ms: number) => new Date(ms).toISOString()
const shift = (at: string, ms: number) => iso(Date.parse(at) + ms)

/**
 * The other tasks that move when `before` becomes `after`, already shifted.
 * Only a later end pushes. The walk starts at the anchor: the old end, or the new start when
 * the task moved past its old end (so a moved task only pushes what sits in its new slot).
 * Still-planned tasks from the anchor on move by the working time the new end gained, while
 * they overlap the chain; the first one clear of it stops the walk. Fixed tasks never move and
 * the moved tasks flow around them; with no fixed tasks this is a plain shift by the delta.
 * Done, skipped and started tasks never move. Moving earlier or shortening never pulls anything back.
 */
export function pushChain(before: Task, after: Task, all: Task[]): Task[] {
  const anchor = chainAnchor(before, after)
  const blocks = fixedBlocks(all, before.id)
  const delta = toWork(Date.parse(after.end), blocks) - toWork(anchor, blocks)
  if (delta <= 0) return []

  const candidates = all
    .filter((t) => t.id !== before.id && t.status === 'planned' && !t.actualStart && !t.fixed && Date.parse(t.start) >= anchor)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
  return shiftChain(candidates, Date.parse(after.end), delta, blocks)
}

/**
 * Move each task, in order, by `delta` of working time while it starts before the frontier,
 * keeping its own working time and flowing it around fixed blocks.
 */
export function shiftChain(candidates: Task[], frontierMs: number, delta: number, blocks: Block[]): Task[] {
  const moved: Task[] = []
  let frontier = frontierMs
  for (const t of candidates) {
    if (Date.parse(t.start) >= frontier) break
    const from = toWork(Date.parse(t.start), blocks) + delta
    const start = toWall(from, blocks, 'start')
    const end = Math.max(start, toWall(from + workMinutes(t, blocks) * MINUTE_MS, blocks, 'end'))
    moved.push(relay(t, start, end))
    frontier = Math.max(frontier, end)
  }
  return moved
}

/** A task at a new start and end; originalEnd keeps its offset from the end. */
export function relay(t: Task, start: number, end: number): Task {
  return { ...t, start: iso(start), end: iso(end), originalEnd: shift(t.originalEnd, end - Date.parse(t.end)) }
}

/** Where the walk starts: the old end, or the new start when the task moved past its old end. */
function chainAnchor(before: Task, after: Task): number {
  return Math.max(Date.parse(before.end), Date.parse(after.start))
}

/** How far, in working minutes, the chain behind a task moves when `before` becomes `after`. */
export function chainShiftMin(before: Task, after: Task, all: Task[] = []): number {
  const blocks = fixedBlocks(all, before.id)
  return Math.round((toWork(Date.parse(after.end), blocks) - toWork(chainAnchor(before, after), blocks)) / MINUTE_MS)
}

/**
 * +30 on a task: it gets 30 more working minutes (an overrun, so originalEnd stays), pausing for
 * any fixed task it meets, and the chain behind it moves.
 */
export function pushTask(task: Task, all: Task[], now: Date): { updated: Task; moved: Task[]; deltaMin: number } {
  const { updated: extended } = extendTask(task, PUSH_MIN, all, now)
  const blocks = task.fixed ? [] : fixedBlocks(all, task.id)
  const base = Date.parse(extended.end) - PUSH_MIN * MINUTE_MS
  const updated = { ...extended, end: iso(toWall(toWork(base, blocks) + PUSH_MIN * MINUTE_MS, blocks, 'end')) }
  return { updated, moved: pushChain(task, updated, all), deltaMin: chainShiftMin(task, updated, all) }
}

/** A new start for a task (Table view): it keeps its working time and flows around fixed tasks. A re-plan, so originalEnd follows. */
export function moveTask(task: Task, startIso: string, all: Task[]): Task {
  const blocks = task.fixed ? [] : fixedBlocks(all, task.id)
  const { start, end } = flowAround(Date.parse(startIso), workMinutes(task, blocks), blocks)
  return { ...task, start: iso(start), end: iso(end), originalEnd: iso(end) }
}

/** The Undo bar's line after a push or a later re-plan. */
export function describePush(title: string, newEnd: string, moved: Task[], deltaMin: number): string {
  const rest = moved.length ? `Moved ${moved.map((t) => t.title).join(', ')} by ${deltaMin} min.` : 'Nothing else moves.'
  return `${title}: ends at ${formatLocalTime(newEnd)}. ${rest}`
}
