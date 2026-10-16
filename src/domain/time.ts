import type { Task } from './task'

const MINUTE_MS = 60_000

/** Local midnight of `day` to the next local midnight, as UTC ISO strings. */
export function dayBounds(day: Date): { fromUtc: string; toUtc: string } {
  const from = new Date(day.getFullYear(), day.getMonth(), day.getDate())
  const to = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
  return { fromUtc: from.toISOString(), toUtc: to.toISOString() }
}

/** Tasks that start on `day` (local time), sorted by start. */
export function tasksForDay(tasks: Task[], day: Date): Task[] {
  const { fromUtc, toUtc } = dayBounds(day)
  const from = Date.parse(fromUtc)
  const to = Date.parse(toUtc)
  return tasks
    .filter((t) => {
      const start = Date.parse(t.start)
      return start >= from && start < to
    })
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
}

const timeFormat = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** 24h local `HH:MM`. */
export function formatLocalTime(iso: string): string {
  return timeFormat.format(new Date(iso))
}

export function minutesBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / MINUTE_MS)
}
