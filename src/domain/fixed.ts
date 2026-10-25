import type { Task, TaskDraft } from './task'
import { formatLocalTime, minutesBetween } from './time'

/** Part of a flexible task's time that a fixed task (a call, a meeting) takes. */
export interface Pause {
  from: string
  to: string
  title: string
}

interface Block {
  from: number
  to: number
  title: string
}

const MINUTE_MS = 60_000

/** Fixed, not-skipped tasks other than `self`, clipped to from..to and merged. A fixed task is never paused. */
function coverage(fromMs: number, toMs: number, self: { id?: string; fixed?: boolean }, dayTasks: Task[]): Block[] {
  if (self.fixed || toMs <= fromMs) return []
  const blocks = dayTasks
    .filter((t) => t.id !== self.id && t.fixed && t.status !== 'skipped')
    .map((t) => ({ from: Math.max(fromMs, Date.parse(t.start)), to: Math.min(toMs, Date.parse(t.end)), title: t.title }))
    .filter((b) => b.to > b.from)
    .sort((a, b) => a.from - b.from)
  const merged: Block[] = []
  for (const b of blocks) {
    const last = merged[merged.length - 1]
    if (last && b.from <= last.to) {
      last.to = Math.max(last.to, b.to)
      last.title = `${last.title} & ${b.title}`
    } else merged.push({ ...b })
  }
  return merged
}

const totalMinutes = (blocks: Block[]) => blocks.reduce((n, b) => n + Math.round((b.to - b.from) / MINUTE_MS), 0)

/** The pauses inside a flexible task's start → end. */
export function pauses(task: Task, dayTasks: Task[]): Pause[] {
  return coverage(Date.parse(task.start), Date.parse(task.end), task, dayTasks).map((b) => ({
    from: new Date(b.from).toISOString(),
    to: new Date(b.to).toISOString(),
    title: b.title,
  }))
}

export function pauseMinutes(task: Task, dayTasks: Task[]): number {
  return totalMinutes(coverage(Date.parse(task.start), Date.parse(task.end), task, dayTasks))
}

/** Planned working minutes: start → originalEnd, without the pauses. Never below 0. */
export function workPlannedMinutes(t: Task, dayTasks: Task[]): number {
  const pause = totalMinutes(coverage(Date.parse(t.start), Date.parse(t.originalEnd), t, dayTasks))
  return Math.max(0, minutesBetween(t.start, t.originalEnd) - pause)
}

/** Minutes worked: real Started → Done time without the pauses, else the planned working time. */
export function workSpentMinutes(t: Task, dayTasks: Task[]): number {
  if (!(t.actualStart && t.actualEnd)) return workPlannedMinutes(t, dayTasks)
  const pause = totalMinutes(coverage(Date.parse(t.actualStart), Date.parse(t.actualEnd), t, dayTasks))
  return Math.max(0, minutesBetween(t.actualStart, t.actualEnd) - pause)
}

/** "Pauses for Call (16:00–16:30)" for each fixed task a flexible draft overlaps. */
export function pauseNotes(draft: TaskDraft, others: Task[]): string[] {
  if (draft.fixed) return []
  const [from, to] = [Date.parse(draft.start), Date.parse(draft.end)]
  return others
    .filter((o) => o.fixed && o.status !== 'skipped' && from < Date.parse(o.end) && Date.parse(o.start) < to)
    .map((o) => `Pauses for ${o.title} (${formatLocalTime(o.start)}–${formatLocalTime(o.end)})`)
}
