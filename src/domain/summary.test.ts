import { describe, expect, test } from 'vitest'
import { summarize } from './summary'
import { ist, makeTask } from '../test-utils/makeTask'

const D = '2026-10-17'

describe('summarize', () => {
  const done = makeTask({
    id: 'a',
    title: 'Client work',
    category: 'freelance',
    start: ist(D, '09:00'),
    end: ist(D, '10:15'),
    originalEnd: ist(D, '10:00'),
    actualStart: ist(D, '09:05'),
    actualEnd: ist(D, '10:20'),
    status: 'done',
  })
  const planned = makeTask({ id: 'b', category: 'office', start: ist(D, '11:00'), end: ist(D, '12:00') })
  const skipped = makeTask({ id: 'c', category: 'youtube', start: ist(D, '13:00'), end: ist(D, '13:30'), status: 'skipped' })

  test('planned minutes use originalEnd; actual uses actualStart to actualEnd', () => {
    expect(summarize([done]).perTask[0]).toMatchObject({ id: 'a', plannedMin: 60, actualMin: 75 })
  })

  test('actual falls back to start when actualStart is missing', () => {
    const noStart = { ...done, actualStart: undefined }
    expect(summarize([noStart]).perTask[0].actualMin).toBe(80)
  })

  test('actual is null until the task is done', () => {
    expect(summarize([planned]).perTask[0].actualMin).toBeNull()
  })

  test('per category: done counts actual, planned counts planned, skipped counts 0', () => {
    expect(summarize([done, planned, skipped]).perCategory).toEqual({ freelance: 75, office: 60, youtube: 0 })
  })

  test('no tasks gives zero for every category', () => {
    expect(summarize([])).toEqual({ perTask: [], perCategory: { office: 0, freelance: 0, youtube: 0 } })
  })
})
