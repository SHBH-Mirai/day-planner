import { describe, expect, test } from 'vitest'
import { describeReplan, firstStart, replanDay, replanStart } from './replan'
import type { Task } from './task'
import { ist, makeTask } from '../test-utils/makeTask'

const D = '2026-10-22'
const at = (title: string, from: string, to: string, over: Partial<Task> = {}) =>
  makeTask({ id: title, title, start: ist(D, from), end: ist(D, to), ...over })
const ms = (hhmm: string) => Date.parse(ist(D, hhmm))
const times = (ts: Task[]) => ts.map((t) => [t.title, t.start, t.end])

describe('replanDay', () => {
  test('planned tasks lie back to back from the start, in order: overdue ones, gaps and overlaps all go', () => {
    const a = at('A', '09:00', '10:00'),
      b = at('B', '11:00', '11:30'),
      c = at('C', '11:15', '12:00')
    expect(times(replanDay([a, b, c], ms('14:00')))).toEqual([
      ['A', ist(D, '14:00'), ist(D, '15:00')],
      ['B', ist(D, '15:00'), ist(D, '15:30')],
      ['C', ist(D, '15:30'), ist(D, '16:15')],
    ])
  })

  test('finishing early brings later tasks forward', () => {
    expect(times(replanDay([at('A', '18:00', '19:00')], ms('15:00')))).toEqual([['A', ist(D, '15:00'), ist(D, '16:00')]])
  })

  test('fixed tasks stay; flexible ones pause around them, and a start inside a call waits for it', () => {
    const call = at('Call', '16:00', '16:30', { fixed: true })
    expect(times(replanDay([at('A', '10:00', '11:30'), call], ms('15:30')))).toEqual([['A', ist(D, '15:30'), ist(D, '17:30')]])
    expect(times(replanDay([call, at('B', '18:00', '18:30')], ms('16:10')))).toEqual([['B', ist(D, '16:30'), ist(D, '17:00')]])
  })

  test('done, skipped and started tasks never move', () => {
    const done = at('Done', '09:00', '10:00', { status: 'done' }),
      skipped = at('Skipped', '10:00', '10:30', { status: 'skipped' }),
      started = at('Started', '13:00', '14:00', { actualStart: ist(D, '13:00') }),
      b = at('B', '11:00', '11:30')
    expect(times(replanDay([done, skipped, started, b], ms('14:00')))).toEqual([['B', ist(D, '14:00'), ist(D, '14:30')]])
  })

  test('a day already back to back from the start changes nothing', () => {
    expect(replanDay([at('A', '14:00', '15:00'), at('B', '15:00', '15:30')], ms('14:00'))).toEqual([])
  })

  test('originalEnd keeps its offset from the end (a +30 overrun stays an overrun)', () => {
    const a = at('A', '09:00', '10:30', { originalEnd: ist(D, '10:00') })
    const [moved] = replanDay([a], ms('14:00'))
    expect([moved.end, moved.originalEnd]).toEqual([ist(D, '15:30'), ist(D, '15:00')])
  })
})

describe('where a re-plan starts', () => {
  test('Today: now, rounded up to the next 5 minutes', () => {
    expect(replanStart([], new Date(ist(D, '03:17')))).toBe(ms('03:20'))
    expect(replanStart([], new Date(ist(D, '03:20')))).toBe(ms('03:20'))
  })

  test('Today: after a running task, or now if it is overrunning', () => {
    const running = at('Running', '14:00', '15:00', { actualStart: ist(D, '14:00') })
    expect(replanStart([running], new Date(ist(D, '14:20')))).toBe(ms('15:00'))
    expect(replanStart([running], new Date(ist(D, '15:12')))).toBe(ms('15:15'))
    const done = at('Done', '14:00', '16:00', { actualStart: ist(D, '14:00'), status: 'done' })
    expect(replanStart([done], new Date(ist(D, '14:20')))).toBe(ms('14:20'))
  })

  test('Tomorrow: the first movable task start; none when nothing can move', () => {
    expect(firstStart([at('Done', '08:00', '09:00', { status: 'done' }), at('B', '10:00', '10:30'), at('A', '09:30', '10:00')])).toBe(ms('09:30'))
    expect(firstStart([at('Call', '09:00', '10:00', { fixed: true })])).toBeUndefined()
  })
})

describe('describeReplan', () => {
  test('how many tasks moved and from when', () => {
    expect(describeReplan([at('A', '14:00', '15:00'), at('B', '15:00', '15:30')], ms('14:00'))).toBe('Re-planned 2 tasks from 14:00')
    expect(describeReplan([at('A', '14:00', '15:00')], ms('14:00'))).toBe('Re-planned 1 task from 14:00')
  })
})
