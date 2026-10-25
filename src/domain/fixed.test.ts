import { describe, expect, test } from 'vitest'
import { pauseMinutes, pauseNotes, pauses } from './fixed'
import { summarize } from './summary'
import { weekReview } from './progress'
import { validateTask } from './validate'
import { dayTotals } from '../ui/neu/totals'
import type { Status, Task } from './task'
import { ist, makeTask } from '../test-utils/makeTask'

const D = '2026-10-22'
const THU = new Date(`${D}T12:00:00+05:30`)
const at = (title: string, from: string, to: string, over: Partial<Task> = {}) => makeTask({ title, start: ist(D, from), end: ist(D, to), ...over })
const call = (from = '16:00', to = '16:30', status: Status = 'planned') => at('Call', from, to, { fixed: true, status })

describe('pauses', () => {
  test('a fixed task inside a flexible one is a pause', () => {
    const a = at('A', '15:30', '17:30')
    expect(pauses(a, [a, call()])).toEqual([{ from: ist(D, '16:00'), to: ist(D, '16:30'), title: 'Call' }])
    expect(pauseMinutes(a, [a, call()])).toBe(30)
  })

  test('only the part inside the task counts', () => {
    const a = at('A', '15:30', '17:30')
    expect(pauseMinutes(a, [a, call('15:00', '15:45')])).toBe(15)
    expect(pauses(a, [a, call('18:00', '18:30')])).toEqual([])
  })

  test('overlapping fixed tasks merge into one pause; separate ones add up', () => {
    const a = at('A', '15:30', '17:30')
    const sync = at('Sync', '16:15', '17:00', { fixed: true })
    expect(pauses(a, [a, call(), sync])).toEqual([{ from: ist(D, '16:00'), to: ist(D, '17:00'), title: 'Call & Sync' }])
    const late = at('Review', '17:00', '17:15', { fixed: true })
    expect(pauseMinutes(a, [a, call(), late])).toBe(45)
  })

  test('a skipped fixed task is no pause, and a fixed task never pauses', () => {
    const a = at('A', '15:30', '17:30')
    expect(pauses(a, [a, call('16:00', '16:30', 'skipped')])).toEqual([])
    const c = call()
    expect(pauses(c, [c, at('Other fixed', '16:00', '16:15', { fixed: true })])).toEqual([])
  })
})

describe('working time leaves the pause out', () => {
  const a = at('A', '15:30', '17:30', { status: 'done' })
  const day = [a, call()]

  test('the focus strip and Summary totals count 90 min for A, not 120', () => {
    expect(dayTotals(day)).toMatchObject({ planned: 120, done: 90 })
    expect(summarize(day).perTask.find((t) => t.title === 'A')?.plannedMin).toBe(90)
  })

  test('real Started/Done time leaves the pause out too', () => {
    const started = { ...a, actualStart: ist(D, '15:30'), actualEnd: ist(D, '17:30') }
    expect(dayTotals([started, call()]).done).toBe(90)
  })

  test('the Week view counts the same', () => {
    const thu = weekReview(day, THU).days[3]
    expect(thu).toMatchObject({ plannedMin: 120, doneMin: 90 })
  })
})

describe('overlaps with fixed tasks are pauses, not warnings', () => {
  const draft = { title: 'A', start: ist(D, '15:30'), end: ist(D, '17:30'), category: 'office' as const }

  test('a flexible task over a fixed one gets a note, not an Overlaps warning', () => {
    expect(pauseNotes(draft, [call()])).toEqual(['Pauses for Call (16:00–16:30)'])
    expect(validateTask(draft, [call()]).warnings).toEqual([])
  })

  test('a fixed task over another fixed one still warns, and gets no note', () => {
    expect(validateTask({ ...draft, fixed: true }, [call()]).warnings).toEqual(['Overlaps Call (16:00–16:30)'])
    expect(pauseNotes({ ...draft, fixed: true }, [call()])).toEqual([])
  })

  test('two flexible tasks still warn', () => {
    expect(validateTask(draft, [at('B', '16:00', '16:30')]).warnings).toEqual(['Overlaps B (16:00–16:30)'])
  })
})
