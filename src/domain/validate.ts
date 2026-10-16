import type { Task, TaskDraft } from './task'
import { formatLocalTime, minutesBetween } from './time'

const MIN_BREAK_MIN = 10
const MAX_RUN_MIN = 180

export interface ValidationResult {
  errors: string[]
  warnings: string[]
}

/** Errors block saving; warnings are shown but saving is allowed. */
export function validateTask(draft: TaskDraft, others: Task[], editingId?: string): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!draft.title.trim()) errors.push('Title is required')
  if (Date.parse(draft.end) <= Date.parse(draft.start)) errors.push('End must be after start')

  for (const other of others) {
    if (other.id === editingId || other.status === 'skipped') continue
    const overlaps = Date.parse(draft.start) < Date.parse(other.end) && Date.parse(other.start) < Date.parse(draft.end)
    if (overlaps) {
      warnings.push(`Overlaps ${other.title} (${formatLocalTime(other.start)}–${formatLocalTime(other.end)})`)
    }
  }

  return { errors, warnings }
}

/** Stretches of 3h+ where every gap between tasks is under 10 minutes. Skipped tasks are ignored. */
export function findNoBreakRuns(tasks: Task[]): { fromUtc: string; toUtc: string }[] {
  const active = tasks
    .filter((t) => t.status !== 'skipped')
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))

  const runs: { fromUtc: string; toUtc: string }[] = []
  let current: { fromUtc: string; toUtc: string } | null = null

  for (const task of active) {
    if (current && minutesBetween(current.toUtc, task.start) < MIN_BREAK_MIN) {
      if (Date.parse(task.end) > Date.parse(current.toUtc)) current.toUtc = task.end
      continue
    }
    if (current) runs.push(current)
    current = { fromUtc: task.start, toUtc: task.end }
  }
  if (current) runs.push(current)

  return runs.filter((r) => minutesBetween(r.fromUtc, r.toUtc) >= MAX_RUN_MIN)
}
