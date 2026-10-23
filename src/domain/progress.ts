import { plannedMinutes, spentMinutes } from './summary'
import { CATEGORIES, emptyPerCategory, type Category, type Task } from './task'
import { tasksForDay } from './time'

/** How far back the Week view reads, and so the longest streak it can see. */
export const STREAK_LOOKBACK_DAYS = 28

/** One day of the week, counted the way the focus strip and the Summary count it. */
export interface DayProgress {
  day: Date
  /** Minutes spent on done tasks: real time when Started was pressed, else the planned length. */
  doneMin: number
  /** Planned minutes of every task that isn't skipped. */
  plannedMin: number
  doneCount: number
  skippedCount: number
  /** After today. */
  future: boolean
}

export interface WeekReview {
  /** Local Monday 00:00. */
  start: Date
  /** Monday to Sunday. */
  days: DayProgress[]
  doneMin: number
  plannedMin: number
  doneCount: number
  skippedCount: number
  /** Done minutes only, so it shows where time actually went. */
  perCategoryDone: Record<Category, number>
  /** Done minutes last week, Monday up to the same weekday as today. */
  lastWeekDoneMin: number
}

export interface Streaks {
  /** Days in a row with at least one task done, ending today (or yesterday while today has nothing done yet). */
  days: number
  /** The run reaches back as far as the Week view reads. */
  capped: boolean
  /** The same per category, 2 days and up, longest first. Breaks & meals don't count. */
  byCategory: { category: Category; days: number }[]
}

const addDays = (day: Date, n: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate() + n)
const midnight = (day: Date) => addDays(day, 0)

/** Local Monday 00:00 of `day`'s week. */
export function weekStart(day: Date): Date {
  const mondayIndex = (day.getDay() + 6) % 7
  return addDays(day, -mondayIndex)
}

function dayProgress(tasks: Task[], day: Date, today: Date): DayProgress {
  const p: DayProgress = { day, doneMin: 0, plannedMin: 0, doneCount: 0, skippedCount: 0, future: day > midnight(today) }
  for (const t of tasksForDay(tasks, day)) {
    if (t.status === 'skipped') {
      p.skippedCount++
      continue
    }
    p.plannedMin += plannedMinutes(t)
    if (t.status === 'done') {
      p.doneCount++
      p.doneMin += spentMinutes(t)
    }
  }
  return p
}

/** This week, Monday to Sunday, plus last week's done time up to the same weekday. */
export function weekReview(tasks: Task[], today: Date): WeekReview {
  const start = weekStart(today)
  const days = Array.from({ length: 7 }, (_, i) => dayProgress(tasks, addDays(start, i), today))
  const perCategoryDone = emptyPerCategory()
  for (const d of days) {
    for (const t of tasksForDay(tasks, d.day)) if (t.status === 'done') perCategoryDone[t.category] += spentMinutes(t)
  }
  const todayIndex = (today.getDay() + 6) % 7
  let lastWeekDoneMin = 0
  for (let i = 0; i <= todayIndex; i++) lastWeekDoneMin += dayProgress(tasks, addDays(start, i - 7), today).doneMin
  const sum = (key: 'doneMin' | 'plannedMin' | 'doneCount' | 'skippedCount') => days.reduce((n, d) => n + d[key], 0)
  return {
    start,
    days,
    doneMin: sum('doneMin'),
    plannedMin: sum('plannedMin'),
    doneCount: sum('doneCount'),
    skippedCount: sum('skippedCount'),
    perCategoryDone,
    lastWeekDoneMin,
  }
}

/** Consecutive days in `doneOn` ending today, or yesterday while today isn't in it yet. */
function run(doneOn: Set<string>, today: Date, lookbackDays: number): number {
  let day = doneOn.has(today.toDateString()) ? midnight(today) : addDays(today, -1)
  let days = 0
  while (days < lookbackDays && doneOn.has(day.toDateString())) {
    days++
    day = addDays(day, -1)
  }
  return days
}

export function streaks(tasks: Task[], today: Date, lookbackDays = STREAK_LOOKBACK_DAYS): Streaks {
  const any = new Set<string>()
  const byCat = new Map<Category, Set<string>>()
  for (const t of tasks) {
    if (t.status !== 'done') continue
    const key = new Date(t.start).toDateString()
    any.add(key)
    if (!byCat.has(t.category)) byCat.set(t.category, new Set())
    byCat.get(t.category)!.add(key)
  }
  const days = run(any, today, lookbackDays)
  const byCategory = CATEGORIES.filter((c) => c !== 'breaks')
    .map((category) => ({ category, days: run(byCat.get(category) ?? new Set(), today, lookbackDays) }))
    .filter((s) => s.days >= 2)
    .sort((a, b) => b.days - a.days)
  return { days, capped: days >= lookbackDays, byCategory }
}
