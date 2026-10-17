import { describe, expect, it } from 'vitest'
import { isOnDay, routineToDraft, validateRoutine, type RoutineDraft } from './routine'
import { ist, makeTask } from '../test-utils/makeTask'

const D = '2026-10-18'
const DAY = new Date('2026-10-18T12:00:00+05:30')

const draft = (over: Partial<RoutineDraft> = {}): RoutineDraft => ({
  title: 'Gym',
  category: 'office',
  startTime: '07:15',
  durationMin: 45,
  days: ['Mon', 'Wed'],
  active: true,
  ...over,
})

describe('validateRoutine', () => {
  it('accepts a valid routine', () => {
    expect(validateRoutine(draft())).toEqual([])
  })

  it('needs a title', () => {
    expect(validateRoutine(draft({ title: '   ' }))).toContain('Add a title')
  })

  it('needs a 24-hour HH:mm time', () => {
    expect(validateRoutine(draft({ startTime: '9:5' }))).toContain('Use a time like 07:15')
    expect(validateRoutine(draft({ startTime: '24:00' }))).toContain('Use a time like 07:15')
  })

  it('keeps the length between 5 minutes and 12 hours', () => {
    expect(validateRoutine(draft({ durationMin: 4 }))).toContain('Length must be 5 to 720 minutes')
    expect(validateRoutine(draft({ durationMin: 721 }))).toContain('Length must be 5 to 720 minutes')
    expect(validateRoutine(draft({ durationMin: 720 }))).toEqual([])
  })

  it('needs at least one day', () => {
    expect(validateRoutine(draft({ days: [] }))).toContain('Pick at least one day')
  })
})

describe('routineToDraft', () => {
  it('becomes a task on the day at its local start time, for its length, in its category', () => {
    const t = routineToDraft({ id: 'r1', ...draft({ category: 'youtube' }) }, DAY)
    expect(t).toEqual({ title: 'Gym', start: ist(D, '07:15'), end: ist(D, '08:00'), category: 'youtube' })
  })

  it('runs past midnight into the next day when it has to', () => {
    const t = routineToDraft({ id: 'r1', ...draft({ startTime: '23:30', durationMin: 60 }) }, DAY)
    expect(t.start).toBe(ist(D, '23:30'))
    expect(t.end).toBe(ist('2026-10-19', '00:30'))
  })
})

describe('isOnDay', () => {
  const routine = { id: 'r1', ...draft() }

  it('is true when a task with the same title and start is already there', () => {
    const task = makeTask({ title: 'Gym', start: ist(D, '07:15'), end: ist(D, '08:30') })
    expect(isOnDay(routine, DAY, [task])).toBe(true)
  })

  it('is false for the same title at another time, or another title at the same time', () => {
    expect(isOnDay(routine, DAY, [makeTask({ title: 'Gym', start: ist(D, '18:00'), end: ist(D, '19:00') })])).toBe(false)
    expect(isOnDay(routine, DAY, [makeTask({ title: 'Run', start: ist(D, '07:15'), end: ist(D, '08:00') })])).toBe(false)
  })
})
