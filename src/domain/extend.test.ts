import { describe, expect, test } from 'vitest'
import { extendTask } from './extend'
import { ist, makeTask } from '../test-utils/makeTask'

const D = '2026-10-17'

describe('extendTask', () => {
  const task = makeTask({ title: 'Deep work', start: ist(D, '09:00'), end: ist(D, '10:00') })
  const next = makeTask({ title: 'Lunch', start: ist(D, '10:00'), end: ist(D, '10:30') })
  const later = makeTask({ title: 'Call', start: ist(D, '10:30'), end: ist(D, '11:00') })

  test('moves end forward and keeps originalEnd', () => {
    const { updated } = extendTask(task, 15, [task, next, later])
    expect(updated.end).toBe(ist(D, '10:15'))
    expect(updated.originalEnd).toBe(ist(D, '10:00'))
  })

  test('lists the later tasks the new end runs into', () => {
    expect(extendTask(task, 15, [task, next, later]).affected).toEqual([next])
  })

  test('extending twice keeps the first originalEnd', () => {
    const once = extendTask(task, 15, [task, next, later]).updated
    const twice = extendTask(once, 15, [once, next, later]).updated
    expect(twice.end).toBe(ist(D, '10:30'))
    expect(twice.originalEnd).toBe(ist(D, '10:00'))
  })

  test('done and skipped tasks are not affected', () => {
    const doneNext = { ...next, status: 'done' as const }
    const skippedNext = { ...next, id: 'skip', status: 'skipped' as const }
    expect(extendTask(task, 15, [task, doneNext, skippedNext]).affected).toEqual([])
  })

  test('does not change its inputs', () => {
    const before = structuredClone(task)
    extendTask(task, 15, [task, next])
    expect(task).toEqual(before)
  })

  test('a late +15 counts from now, not from the old end', () => {
    const now = new Date(ist(D, '10:40'))
    const { updated, affected } = extendTask(task, 15, [task, next, later], now)
    expect(updated.end).toBe(ist(D, '10:55'))
    expect(updated.originalEnd).toBe(ist(D, '10:00'))
    expect(affected).toEqual([next, later])
  })
})
