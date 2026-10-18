import { describe, expect, test } from 'vitest'
import { describePush, pushChain, pushTask, PUSH_MIN } from './push'
import type { Task } from './task'
import { ist, makeTask } from '../test-utils/makeTask'

const D = '2026-10-17'
const at = (title: string, from: string, to: string, over: Partial<Task> = {}) =>
  makeTask({ title, start: ist(D, from), end: ist(D, to), ...over })

describe('pushChain', () => {
  test('nothing moves when the end does not move later', () => {
    const a = at('A', '09:00', '09:30'),
      b = at('B', '09:30', '10:00')
    expect(pushChain(a, a, [a, b])).toEqual([])
    expect(pushChain(a, { ...a, end: ist(D, '09:15') }, [a, b])).toEqual([])
  })

  test('moves the touching chain by the same amount and stops at the first gap', () => {
    const a = at('A', '09:00', '09:30'),
      b = at('B', '09:30', '10:00'),
      c = at('C', '10:00', '11:30'),
      d = at('D', '14:00', '15:00')
    const moved = pushChain(a, { ...a, end: ist(D, '10:00') }, [a, b, c, d])
    expect(moved.map((t) => [t.title, t.start, t.end, t.originalEnd])).toEqual([
      ['B', ist(D, '10:00'), ist(D, '10:30'), ist(D, '10:30')],
      ['C', ist(D, '10:30'), ist(D, '12:00'), ist(D, '12:00')],
    ])
  })

  test('a partial overlap still moves by the full amount', () => {
    const a = at('A', '09:00', '10:00'),
      b = at('B', '10:00', '11:00'),
      c = at('C', '11:15', '11:45')
    const moved = pushChain(a, { ...a, end: ist(D, '10:30') }, [a, b, c])
    expect(moved.map((t) => [t.title, t.start])).toEqual([
      ['B', ist(D, '10:30')],
      ['C', ist(D, '11:45')],
    ])
  })

  test('done, skipped and started tasks never move or block the chain', () => {
    const a = at('A', '09:00', '09:30')
    const done = at('Done', '09:30', '09:40', { status: 'done' })
    const skipped = at('Skipped', '09:30', '09:40', { status: 'skipped' })
    const started = at('Started', '09:30', '09:40', { actualStart: ist(D, '09:30') })
    const b = at('B', '09:45', '10:15')
    const moved = pushChain(a, { ...a, end: ist(D, '10:00') }, [a, done, skipped, started, b])
    expect(moved.map((t) => t.title)).toEqual(['B'])
  })

  test('a chain that runs past midnight still moves', () => {
    const a = at('A', '23:00', '23:30'),
      b = at('B', '23:30', '23:50')
    const [m] = pushChain(a, { ...a, end: ist('2026-10-18', '00:00') }, [a, b])
    expect([m.start, m.end]).toEqual([ist('2026-10-18', '00:00'), ist('2026-10-18', '00:20')])
  })

  test('moving a task later only pushes what sits in its new slot', () => {
    const s = at('Standup', '09:00', '09:15'),
      coffee = at('Coffee', '09:15', '09:25'),
      review = at('Review', '10:00', '11:00'),
      lunch = at('Lunch', '13:00', '13:45')
    const moved = pushChain(s, { ...s, start: ist(D, '13:00'), end: ist(D, '13:15') }, [s, coffee, review, lunch])
    expect(moved.map((t) => [t.title, t.start, t.end])).toEqual([['Lunch', ist(D, '13:15'), ist(D, '14:00')]])
  })

  test('moving a task into a free gap moves nothing', () => {
    const s = at('Standup', '09:00', '09:15'),
      coffee = at('Coffee', '09:15', '09:25'),
      review = at('Review', '10:00', '11:00')
    expect(pushChain(s, { ...s, start: ist(D, '09:40'), end: ist(D, '09:55') }, [s, coffee, review])).toEqual([])
  })

  test('a small move later pushes what its new end now reaches', () => {
    const s = at('Standup', '09:00', '09:15'),
      review = at('Review', '09:20', '10:00')
    const moved = pushChain(s, { ...s, start: ist(D, '09:10'), end: ist(D, '09:25') }, [s, review])
    expect(moved.map((t) => [t.title, t.start, t.end])).toEqual([['Review', ist(D, '09:30'), ist(D, '10:10')]])
  })

  test('does not change its inputs', () => {
    const a = at('A', '09:00', '09:30'),
      b = at('B', '09:30', '10:00')
    const all = [a, b]
    const copy = structuredClone(all)
    pushChain(a, { ...a, end: ist(D, '10:00') }, all)
    expect(all).toEqual(copy)
  })
})

describe('pushTask', () => {
  test('gives the task 30 more minutes, keeps its originalEnd, and moves the chain', () => {
    const s = at('Standup', '09:00', '09:15'),
      r = at('Review', '09:20', '10:00')
    const { updated, moved, deltaMin } = pushTask(s, [s, r], new Date(ist(D, '09:10')))
    expect(PUSH_MIN).toBe(30)
    expect([updated.end, updated.originalEnd]).toEqual([ist(D, '09:45'), ist(D, '09:15')])
    expect(moved.map((t) => [t.title, t.start, t.end])).toEqual([['Review', ist(D, '09:50'), ist(D, '10:30')]])
    expect(deltaMin).toBe(30)
  })

  test('a late push moves the chain by the real delta', () => {
    const a = at('A', '09:00', '09:30'),
      b = at('B', '09:30', '10:00')
    const { updated, moved, deltaMin } = pushTask(a, [a, b], new Date(ist(D, '09:42')))
    expect(updated.end).toBe(ist(D, '10:12'))
    expect(deltaMin).toBe(42)
    expect(moved[0].start).toBe(ist(D, '10:12'))
  })
})

describe('describePush', () => {
  test('names what moved and by how much', () => {
    const b = at('B', '10:00', '10:30'),
      c = at('C', '10:30', '11:00')
    expect(describePush('Standup', ist(D, '09:45'), [b, c], 30)).toBe('Standup: ends at 09:45. Moved B, C by 30 min.')
  })

  test('says when nothing else moves', () => {
    expect(describePush('Standup', ist(D, '09:45'), [], 30)).toBe('Standup: ends at 09:45. Nothing else moves.')
  })
})
