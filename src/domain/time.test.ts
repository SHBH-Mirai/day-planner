import { describe, expect, test } from 'vitest'
import { dayBounds, formatLocalTime, minutesBetween, tasksForDay, withLocalTime } from './time'
import { ist, makeTask } from '../test-utils/makeTask'

describe('dayBounds', () => {
  test('spans local (IST) midnight to next local midnight, in UTC', () => {
    expect(dayBounds(new Date('2026-10-17T10:00:00+05:30'))).toEqual({
      fromUtc: '2026-10-16T18:30:00.000Z',
      toUtc: '2026-10-17T18:30:00.000Z',
    })
  })
})

describe('tasksForDay', () => {
  const lateNight = makeTask({
    start: ist('2026-10-17', '23:30'),
    end: ist('2026-10-18', '00:30'),
  })

  test('a task crossing midnight belongs to the day it starts', () => {
    expect(tasksForDay([lateNight], new Date('2026-10-17T12:00:00+05:30'))).toEqual([lateNight])
  })

  test('a task crossing midnight is not on the next day', () => {
    expect(tasksForDay([lateNight], new Date('2026-10-18T12:00:00+05:30'))).toEqual([])
  })

  test('returns tasks sorted by start', () => {
    const b = makeTask({ start: ist('2026-10-17', '11:00'), end: ist('2026-10-17', '12:00') })
    const a = makeTask({ start: ist('2026-10-17', '09:00'), end: ist('2026-10-17', '10:00') })
    expect(tasksForDay([b, a], new Date('2026-10-17T12:00:00+05:30'))).toEqual([a, b])
  })
})

describe('formatLocalTime', () => {
  test('shows 24h local HH:MM', () => {
    expect(formatLocalTime('2026-10-17T03:30:00Z')).toBe('09:00')
    expect(formatLocalTime('2026-10-17T14:45:00Z')).toBe('20:15')
  })
})

describe('minutesBetween', () => {
  test('counts whole minutes', () => {
    expect(minutesBetween('2026-10-17T03:30:00Z', '2026-10-17T04:15:00Z')).toBe(45)
  })
})

describe('withLocalTime', () => {
  test('keeps the local day and sets the time', () => {
    expect(withLocalTime(ist('2026-10-17', '09:00'), '10:15')).toBe(ist('2026-10-17', '10:15'))
  })
})
