import type { Task } from '../domain/task'

export const MISSED_AFTER_MS = 10 * 60_000

export type NudgeKind = 'start' | 'end'

export interface Nudge {
  key: string
  kind: NudgeKind
  task: Task
  /** More than 10 minutes late, e.g. the laptop was asleep. */
  missed: boolean
}

/** Includes the time, so moving a start or extending an end re-arms the nudge. */
export function nudgeKey(task: Task, kind: NudgeKind): string {
  return `${task.id}:${kind}:${kind === 'start' ? task.start : task.end}`
}

/**
 * Nudges whose time has come and that haven't fired yet, in time order.
 * Only planned tasks nudge. `notBefore` drops nudges older than that moment.
 */
export function dueNudges(tasks: Task[], now: Date, fired: ReadonlySet<string>, notBefore?: Date): Nudge[] {
  const nowMs = now.getTime()
  const floor = notBefore?.getTime() ?? -Infinity
  const due: { at: number; nudge: Nudge }[] = []

  for (const task of tasks) {
    if (task.status !== 'planned') continue
    for (const kind of ['start', 'end'] as const) {
      if (kind === 'start' && task.actualStart) continue
      const at = Date.parse(kind === 'start' ? task.start : task.end)
      const key = nudgeKey(task, kind)
      if (at > nowMs || at < floor || fired.has(key)) continue
      due.push({ at, nudge: { key, kind, task, missed: nowMs - at > MISSED_AFTER_MS } })
    }
  }

  return due.sort((a, b) => a.at - b.at).map((d) => d.nudge)
}
