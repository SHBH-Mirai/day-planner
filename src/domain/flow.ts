import type { Task } from './task'

/** Wall-clock time a fixed task holds, in ms since the epoch. */
export interface Block {
  from: number
  to: number
}

const MINUTE_MS = 60_000

/** Fixed, not-skipped tasks (other than `exceptId`), merged and sorted. Flexible work flows around these. */
export function fixedBlocks(tasks: Task[], exceptId?: string): Block[] {
  const blocks = tasks
    .filter((t) => t.fixed && t.status !== 'skipped' && t.id !== exceptId)
    .map((t) => ({ from: Date.parse(t.start), to: Date.parse(t.end) }))
    .filter((b) => b.to > b.from)
    .sort((a, b) => a.from - b.from)
  const merged: Block[] = []
  for (const b of blocks) {
    const last = merged[merged.length - 1]
    if (last && b.from <= last.to) last.to = Math.max(last.to, b.to)
    else merged.push({ ...b })
  }
  return merged
}

/**
 * Working-time position of a wall-clock moment: the moment minus the fixed time before it.
 * Chains shift in this time, so a fixed block between tasks never counts as a gap to keep.
 */
export function toWork(ms: number, blocks: Block[]): number {
  return blocks.reduce((w, b) => (b.from < ms ? w - (Math.min(ms, b.to) - b.from) : w), ms)
}

/** The wall-clock moment for a working-time position. A start never sits inside or at the start of a block. */
export function toWall(work: number, blocks: Block[], edge: 'start' | 'end'): number {
  let w = work
  for (const b of blocks) {
    if (edge === 'start' ? b.from <= w : b.from < w) w += b.to - b.from
    else break
  }
  return w
}

/** Working minutes inside a task's own span (its pauses left out). */
export function workMinutes(task: Task, blocks: Block[]): number {
  return Math.round((toWork(Date.parse(task.end), blocks) - toWork(Date.parse(task.start), blocks)) / MINUTE_MS)
}

/**
 * Lay `workMin` minutes of work from `startMs`, pausing for each fixed block it meets.
 * A start inside a block waits for the block to end.
 */
export function flowAround(startMs: number, workMin: number, blocks: Block[]): { start: number; end: number } {
  const from = toWork(startMs, blocks)
  const start = toWall(from, blocks, 'start')
  return { start, end: Math.max(start, toWall(from + workMin * MINUTE_MS, blocks, 'end')) }
}
