import { describe, expect, test } from 'vitest'
import { STREAK_LOOKBACK_DAYS, streaks, weekReview, weekStart } from './progress'
import type { Category, Status, Task } from './task'
import { ist, makeTask } from '../test-utils/makeTask'

/** Thursday, mid-day, IST (tests run in IST). */
const THU = new Date('2026-10-22T12:00:00+05:30')

const task = (day: string, from: string, to: string, status: Status, category: Category = 'office', over: Partial<Task> = {}) =>
  makeTask({ start: ist(day, from), end: ist(day, to), status, category, ...over })
const done = (day: string, category: Category = 'office') => task(day, '09:00', '10:00', 'done', category)

/** The local date of the day `n` days before `from`, as yyyy-mm-dd. */
function daysBefore(from: Date, n: number): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

describe('weekStart', () => {
  test('is local Monday 00:00 of the same week', () => {
    const start = weekStart(THU)
    expect(start.toDateString()).toBe(new Date(2026, 9, 19).toDateString())
    expect([start.getHours(), start.getMinutes()]).toEqual([0, 0])
  })

  test('a Monday maps to itself', () => {
    expect(weekStart(new Date('2026-10-19T00:10:00+05:30')).toDateString()).toBe(new Date(2026, 9, 19).toDateString())
  })

  test('a Sunday maps to the Monday before, across a month boundary', () => {
    expect(weekStart(new Date('2026-11-01T23:50:00+05:30')).toDateString()).toBe(new Date(2026, 9, 26).toDateString())
  })
})

describe('weekReview', () => {
  const tasks = [
    task('2026-10-19', '09:00', '10:00', 'done', 'office'),
    task('2026-10-19', '11:00', '11:30', 'planned', 'youtube'),
    task('2026-10-19', '12:00', '13:00', 'skipped', 'learning'),
    task('2026-10-20', '10:00', '11:00', 'done', 'youtube', { actualStart: ist('2026-10-20', '10:00'), actualEnd: ist('2026-10-20', '10:20') }),
    task('2026-10-23', '09:00', '09:30', 'planned', 'office'),
    // last week: Mon and Thu count (up to today's weekday); Fri doesn't
    task('2026-10-12', '09:00', '09:30', 'done', 'office'),
    task('2026-10-15', '09:00', '09:45', 'done', 'office'),
    task('2026-10-16', '09:00', '11:00', 'done', 'office'),
  ]
  const review = weekReview(tasks, THU)

  test('seven days from Monday, with the days after today marked future', () => {
    expect(review.days).toHaveLength(7)
    expect(review.days[0].day.toDateString()).toBe(new Date(2026, 9, 19).toDateString())
    expect(review.days.map((d) => d.future)).toEqual([false, false, false, false, true, true, true])
  })

  test('each day counts done and planned minutes, done and skipped tasks', () => {
    expect(review.days[0]).toMatchObject({ doneMin: 60, plannedMin: 90, doneCount: 1, skippedCount: 1 })
    expect(review.days[1]).toMatchObject({ doneMin: 20, plannedMin: 60, doneCount: 1, skippedCount: 0 })
    expect(review.days[4]).toMatchObject({ doneMin: 0, plannedMin: 30, doneCount: 0 })
  })

  test('the week totals add up the days', () => {
    expect(review).toMatchObject({ doneMin: 80, plannedMin: 180, doneCount: 2, skippedCount: 1 })
  })

  test('time by category counts done tasks only, at their spent time', () => {
    expect(review.perCategoryDone.office).toBe(60)
    expect(review.perCategoryDone.youtube).toBe(20)
    expect(review.perCategoryDone.learning).toBe(0)
  })

  test('last week is compared up to the same weekday', () => {
    expect(review.lastWeekDoneMin).toBe(75)
  })
})

describe('streaks', () => {
  test('no done tasks: no streak', () => {
    expect(streaks([], THU)).toEqual({ days: 0, capped: false, byCategory: [] })
  })

  test('today with nothing done yet does not break the run', () => {
    expect(streaks([done('2026-10-19'), done('2026-10-20'), done('2026-10-21')], THU).days).toBe(3)
  })

  test('a task done today extends the run', () => {
    expect(streaks([done('2026-10-20'), done('2026-10-21'), done('2026-10-22')], THU).days).toBe(3)
  })

  test('a day with nothing done stops it', () => {
    expect(streaks([done('2026-10-19'), done('2026-10-21')], THU).days).toBe(1)
  })

  test('only done tasks count', () => {
    const tasks = [done('2026-10-20'), task('2026-10-21', '09:00', '10:00', 'planned'), task('2026-10-21', '11:00', '12:00', 'skipped')]
    expect(streaks(tasks, THU).days).toBe(0)
  })

  test('a run as long as the lookback reads as capped', () => {
    const every = Array.from({ length: STREAK_LOOKBACK_DAYS }, (_, n) => done(daysBefore(THU, n)))
    expect(streaks(every, THU)).toMatchObject({ days: 28, capped: true })
    expect(STREAK_LOOKBACK_DAYS).toBe(28)
  })

  test('category streaks leave out Breaks & meals and one-day runs', () => {
    const tasks = [
      ...['2026-10-20', '2026-10-21', '2026-10-22'].map((d) => done(d, 'youtube')),
      ...['2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22'].map((d) => done(d, 'breaks')),
      done('2026-10-22', 'office'),
    ]
    expect(streaks(tasks, THU).byCategory).toEqual([{ category: 'youtube', days: 3 }])
  })

  test('category streaks sort by length, then in category order', () => {
    const tasks = [
      ...['2026-10-21', '2026-10-22'].map((d) => done(d, 'learning')),
      ...['2026-10-21', '2026-10-22'].map((d) => done(d, 'office')),
      ...['2026-10-19', '2026-10-20', '2026-10-21'].map((d) => done(d, 'health')),
    ]
    expect(streaks(tasks, THU).byCategory).toEqual([
      { category: 'health', days: 3 },
      { category: 'office', days: 2 },
      { category: 'learning', days: 2 },
    ])
  })
})
