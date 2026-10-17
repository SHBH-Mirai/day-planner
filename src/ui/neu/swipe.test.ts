import { describe, expect, it } from 'vitest'
import { swipeAction, swipeTarget } from './swipe'
import type { Task } from '../../domain/task'

describe('swipeAction', () => {
  it('reads a long right drag as right', () => {
    expect(swipeAction(120, 5, 300)).toBe('right')
  })

  it('reads a long left drag as left', () => {
    expect(swipeAction(-120, 5, 300)).toBe('left')
  })

  it('ignores a drag shorter than 30% of the row', () => {
    expect(swipeAction(60, 0, 300)).toBeNull()
  })

  it('ignores a mostly vertical drag, so the list can scroll', () => {
    expect(swipeAction(10, 80, 300)).toBeNull()
    expect(swipeAction(100, 120, 300)).toBeNull()
  })
})

const task = (over: Partial<Task> = {}): Task => ({
  id: '1',
  title: 'Standup',
  start: '2026-10-17T09:00:00.000Z',
  end: '2026-10-17T09:30:00.000Z',
  originalEnd: '2026-10-17T09:30:00.000Z',
  category: 'office',
  status: 'planned',
  ...over,
})

describe('swipeTarget', () => {
  it('right on a task not started yet means Started', () => {
    expect(swipeTarget(task(), 'right')).toBe('started')
  })

  it('right on a started task means Done', () => {
    expect(swipeTarget(task({ actualStart: '2026-10-17T09:01:00.000Z' }), 'right')).toBe('done')
  })

  it('left means Skip', () => {
    expect(swipeTarget(task(), 'left')).toBe('skip')
  })

  it('does nothing on a task that is already done or skipped', () => {
    expect(swipeTarget(task({ status: 'done' }), 'right')).toBeNull()
    expect(swipeTarget(task({ status: 'skipped' }), 'left')).toBeNull()
  })
})
