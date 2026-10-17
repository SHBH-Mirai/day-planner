import { describe, expect, it } from 'vitest'
import { dayTotals } from './totals'
import { ist, makeTask } from '../../test-utils/makeTask'

const D = '2026-10-17'

describe('dayTotals', () => {
  it('counts real minutes for a done task that was Started', () => {
    const t = makeTask({
      category: 'office',
      status: 'done',
      start: ist(D, '09:00'),
      end: ist(D, '10:00'),
      originalEnd: ist(D, '10:00'),
      actualStart: ist(D, '09:10'),
      actualEnd: ist(D, '10:20'),
    })
    expect(dayTotals([t])).toMatchObject({ planned: 60, done: 70, perCategory: { office: 70 } })
  })

  it('counts the planned length for a done task ticked without Started, even hours late', () => {
    const t = makeTask({
      status: 'done',
      start: ist(D, '09:00'),
      end: ist(D, '09:15'),
      originalEnd: ist(D, '09:15'),
      actualEnd: ist(D, '15:51'),
    })
    expect(dayTotals([t])).toMatchObject({ planned: 15, done: 15 })
  })

  it('never goes negative, e.g. a task ticked done before it was due', () => {
    const t = makeTask({
      status: 'done',
      start: ist(D, '18:00'),
      end: ist(D, '19:00'),
      originalEnd: ist(D, '19:00'),
      actualStart: ist(D, '18:30'),
      actualEnd: ist(D, '18:00'),
    })
    expect(dayTotals([t]).done).toBe(0)
  })

  it('leaves skipped tasks out and counts planned ones by category at their planned length', () => {
    const skipped = makeTask({ category: 'freelance', status: 'skipped', start: ist(D, '11:00'), end: ist(D, '12:00') })
    const planned = makeTask({ category: 'youtube', start: ist(D, '20:00'), end: ist(D, '21:30') })
    expect(dayTotals([skipped, planned])).toMatchObject({
      planned: 90,
      done: 0,
      doneCount: 0,
      skippedCount: 1,
      perCategory: { office: 0, freelance: 0, youtube: 90 },
    })
  })
})
