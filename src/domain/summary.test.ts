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

  test('a task ticked done without Started counts its planned length, however late', () => {
    const noStart = { ...done, actualStart: undefined, actualEnd: ist(D, '15:51') }
    const summary = summarize([noStart])
    expect(summary.perTask[0].actualMin).toBe(60)
    expect(summary.perCategory.freelance).toBe(60)
  })

  test('a task ticked done before its planned start without Started never goes negative', () => {
    const early = { ...done, actualStart: undefined, actualEnd: ist(D, '08:30') }
    expect(summarize([early]).perTask[0].actualMin).toBe(60)
  })

  test('actual minutes never go below 0, e.g. an end before the start', () => {
    const backwards = { ...done, actualStart: ist(D, '10:00'), actualEnd: ist(D, '09:50') }
    expect(summarize([backwards]).perTask[0].actualMin).toBe(0)
  })

  test('planned minutes never go below 0 either', () => {
    const odd = makeTask({ start: ist(D, '10:00'), end: ist(D, '10:00'), originalEnd: ist(D, '09:30') })
    expect(summarize([odd]).perTask[0].plannedMin).toBe(0)
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
