import { describe, expect, test } from 'vitest'
import { describeReorder, dropIndex, moveTarget, reorderDay } from './reorder'
import { moveTask } from './push'
import type { Task } from './task'
import { ist, makeTask } from '../test-utils/makeTask'

const D = '2026-10-22'
const at = (title: string, from: string, to: string, over: Partial<Task> = {}) =>
  makeTask({ id: title, title, start: ist(D, from), end: ist(D, to), ...over })
const times = (ts: Task[]) => ts.map((t) => [t.title, t.start, t.end])

describe('reorderDay', () => {
  test('worked example 1: drag B above A and the two lie back to back from the earliest start', () => {
    const a = at('A', '16:00', '17:30'),
      b = at('B', '17:00', '17:30')
    const changed = reorderDay([a, b], 'B', 'A')
    expect(times(changed)).toEqual([
      ['B', ist(D, '16:00'), ist(D, '16:30')],
      ['A', ist(D, '16:30'), ist(D, '18:00')],
    ])
    expect(changed.map((t) => t.originalEnd)).toEqual([ist(D, '16:30'), ist(D, '18:00')])
  })

  test('worked example 2: A dragged above B flows around the fixed call and B follows it', () => {
    const b = at('B', '15:30', '16:00'),
      call = at('Call', '16:00', '16:30', { fixed: true }),
      a = at('A', '16:30', '18:00')
    expect(times(reorderDay([b, call, a], 'A', 'B'))).toEqual([
      ['A', ist(D, '15:30'), ist(D, '17:30')],
      ['B', ist(D, '17:30'), ist(D, '18:00')],
    ])
  })

  test('moving down and moving to the end', () => {
    const a = at('A', '09:00', '10:00'),
      b = at('B', '10:00', '11:00'),
      c = at('C', '11:00', '12:00')
    expect(times(reorderDay([a, b, c], 'A', 'C'))).toEqual([
      ['B', ist(D, '09:00'), ist(D, '10:00')],
      ['A', ist(D, '10:00'), ist(D, '11:00')],
    ])
    expect(times(reorderDay([a, b, c], 'A', null))).toEqual([
      ['B', ist(D, '09:00'), ist(D, '10:00')],
      ['C', ist(D, '10:00'), ist(D, '11:00')],
      ['A', ist(D, '11:00'), ist(D, '12:00')],
    ])
  })

  test('dropping a task where it already is changes nothing', () => {
    const a = at('A', '09:00', '10:00'),
      b = at('B', '10:00', '11:00')
    expect(reorderDay([a, b], 'A', 'B')).toEqual([])
    expect(reorderDay([a, b], 'B', null)).toEqual([])
    expect(reorderDay([a, b], 'A', 'A')).toEqual([])
  })

  test('done, started and fixed tasks neither move nor can be dragged', () => {
    const a = at('A', '09:00', '10:00'),
      done = at('Done', '10:00', '10:30', { status: 'done' }),
      started = at('Started', '10:30', '11:00', { actualStart: ist(D, '10:30') }),
      b = at('B', '11:00', '11:30')
    expect(times(reorderDay([a, done, started, b], 'B', 'A'))).toEqual([
      ['B', ist(D, '09:00'), ist(D, '09:30')],
      ['A', ist(D, '09:30'), ist(D, '10:30')],
    ])
    expect(reorderDay([a, done, b], 'Done', 'A')).toEqual([])
    expect(reorderDay([a, at('Call', '12:00', '12:30', { fixed: true })], 'Call', 'A')).toEqual([])
  })

  test('a later task the new order now overlaps is pushed; a later clear one stays', () => {
    const a = at('A', '16:00', '17:30'),
      b = at('B', '17:00', '17:30'),
      c = at('C', '17:30', '18:00'),
      d = at('D', '19:00', '19:30')
    expect(times(reorderDay([a, b, c, d], 'B', 'A'))).toEqual([
      ['B', ist(D, '16:00'), ist(D, '16:30')],
      ['A', ist(D, '16:30'), ist(D, '18:00')],
      ['C', ist(D, '18:00'), ist(D, '18:30')],
    ])
  })

  test('does not change its inputs', () => {
    const all = [at('A', '16:00', '17:30'), at('B', '17:00', '17:30')]
    const copy = structuredClone(all)
    reorderDay(all, 'B', 'A')
    expect(all).toEqual(copy)
  })
})

describe('moveTarget', () => {
  const a = at('A', '09:00', '10:00'),
    done = at('Done', '10:00', '10:30', { status: 'done' }),
    b = at('B', '10:30', '11:00'),
    c = at('C', '11:00', '11:30')
  const day = [a, done, b, c]

  test('up goes before the previous movable task, down after the next one', () => {
    expect(moveTarget(day, 'B', -1)).toBe('A')
    expect(moveTarget(day, 'A', 1)).toBe('C')
    expect(moveTarget(day, 'B', 1)).toBeNull()
  })

  test('undefined when there is nowhere to go or the task cannot move', () => {
    expect(moveTarget(day, 'A', -1)).toBeUndefined()
    expect(moveTarget(day, 'C', 1)).toBeUndefined()
    expect(moveTarget(day, 'Done', 1)).toBeUndefined()
  })
})

describe('dropIndex', () => {
  const rows = [
    { top: 0, height: 40 },
    { top: 40, height: 40 },
    { top: 80, height: 40 },
  ]
  test('the gap the pointer is nearest to, from 0 (above the first row) to the row count', () => {
    expect(dropIndex(5, rows)).toBe(0)
    expect(dropIndex(25, rows)).toBe(1)
    expect(dropIndex(70, rows)).toBe(2)
    expect(dropIndex(119, rows)).toBe(3)
    expect(dropIndex(500, rows)).toBe(3)
  })
})

describe('describeReorder', () => {
  test('names the dragged task, the next one that moved, and how many more', () => {
    const changed = [at('B', '16:00', '16:30'), at('A', '16:30', '18:00'), at('C', '18:00', '18:30'), at('D', '18:30', '19:00')]
    expect(describeReorder(changed)).toBe('Moved B to 16:00 · A now 16:30 · 2 more')
    expect(describeReorder(changed.slice(0, 1))).toBe('Moved B to 16:00')
  })
})

describe('moveTask (a new start in Table view)', () => {
  test('keeps the working time and flows around a fixed call', () => {
    const a = at('A', '13:00', '14:30'),
      call = at('Call', '16:00', '16:30', { fixed: true })
    const moved = moveTask(a, ist(D, '15:30'), [a, call])
    expect([moved.start, moved.end, moved.originalEnd]).toEqual([ist(D, '15:30'), ist(D, '17:30'), ist(D, '17:30')])
  })

  test('with no fixed tasks it is the same span at the new start', () => {
    const a = at('A', '13:00', '14:30')
    const moved = moveTask(a, ist(D, '15:30'), [a])
    expect([moved.start, moved.end, moved.originalEnd]).toEqual([ist(D, '15:30'), ist(D, '17:00'), ist(D, '17:00')])
  })
})
