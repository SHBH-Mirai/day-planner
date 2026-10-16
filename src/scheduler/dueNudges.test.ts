import { describe, expect, test } from 'vitest'
import { dueNudges, nudgeKey } from './dueNudges'
import { ist, makeTask } from '../test-utils/makeTask'

const D = '2026-10-17'
const at = (hhmm: string, seconds = 0) => new Date(Date.parse(ist(D, hhmm)) + seconds * 1000)
const task = makeTask({ id: 'deep', start: ist(D, '09:00'), end: ist(D, '10:00') })
const none = new Set<string>()

describe('dueNudges', () => {
  test('nothing is due one second before start', () => {
    expect(dueNudges([task], at('09:00', -1), none)).toEqual([])
  })

  test('the start nudge is due at start', () => {
    expect(dueNudges([task], at('09:00'), none)).toEqual([
      { key: nudgeKey(task, 'start'), kind: 'start', task, missed: false },
    ])
  })

  test('a fired nudge is not due again', () => {
    expect(dueNudges([task], at('09:01'), new Set([nudgeKey(task, 'start')]))).toEqual([])
  })

  test('extending re-arms the end nudge at the new end', () => {
    const fired = new Set([nudgeKey(task, 'start'), nudgeKey(task, 'end')])
    const extended = { ...task, end: ist(D, '10:15') }
    expect(dueNudges([extended], at('10:05'), fired)).toEqual([])
    expect(dueNudges([extended], at('10:15'), fired).map((n) => n.kind)).toEqual(['end'])
  })

  test('moving the start later re-arms the start nudge', () => {
    const fired = new Set([nudgeKey(task, 'start')])
    const moved = { ...task, start: ist(D, '09:30') }
    expect(dueNudges([moved], at('09:30'), fired).map((n) => n.kind)).toEqual(['start'])
  })

  test('after a long sleep each overdue nudge comes once, flagged missed', () => {
    const tasks = [
      task,
      makeTask({ start: ist(D, '10:00'), end: ist(D, '10:30') }),
      makeTask({ start: ist(D, '10:30'), end: ist(D, '13:00') }),
    ]
    const due = dueNudges(tasks, at('12:00'), none)
    expect(due.filter((n) => n.kind === 'start')).toHaveLength(3)
    expect(due.every((n) => n.missed)).toBe(true)
  })

  test('a nudge up to 10 minutes late is not missed', () => {
    expect(dueNudges([task], at('09:10'), none)[0].missed).toBe(false)
    expect(dueNudges([task], at('09:10', 1), none)[0].missed).toBe(true)
  })

  test('done and skipped tasks never nudge', () => {
    const done = { ...task, status: 'done' as const }
    const skipped = { ...task, status: 'skipped' as const }
    expect(dueNudges([done, skipped], at('11:00'), none)).toEqual([])
  })

  test('no start nudge once the task was started by hand', () => {
    const started = { ...task, actualStart: ist(D, '08:55') }
    expect(dueNudges([started], at('09:00'), none)).toEqual([])
  })

  test('nudges older than notBefore are ignored (page opened later in the day)', () => {
    expect(dueNudges([task], at('15:00'), none, at('14:50'))).toEqual([])
  })

  test('nudges come in time order', () => {
    const early = makeTask({ start: ist(D, '08:00'), end: ist(D, '08:30') })
    expect(dueNudges([task, early], at('09:00'), none).map((n) => n.task.id)).toEqual([early.id, early.id, task.id])
  })
})
