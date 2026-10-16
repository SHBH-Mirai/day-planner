import type { Task } from '../domain/task'

let seq = 0

/** Test helper: a planned office task with sensible defaults. */
export function makeTask(overrides: Partial<Task> = {}): Task {
  seq += 1
  const start = overrides.start ?? '2026-10-17T03:30:00.000Z'
  const end = overrides.end ?? '2026-10-17T04:30:00.000Z'
  return {
    id: `t${seq}`,
    title: `Task ${seq}`,
    start,
    end,
    originalEnd: end,
    category: 'office',
    status: 'planned',
    ...overrides,
  }
}

/** IST wall-clock time on a given day → UTC ISO string. */
export function ist(day: string, hhmm: string): string {
  return new Date(`${day}T${hhmm}:00+05:30`).toISOString()
}
