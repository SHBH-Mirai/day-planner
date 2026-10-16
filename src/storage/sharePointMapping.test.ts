import { describe, expect, test } from 'vitest'
import { fromItem, toFields } from './sharePointMapping'
import { ist, makeTask } from '../test-utils/makeTask'

const D = '2026-10-17'

describe('SharePoint mapping', () => {
  test('a full task survives a round trip', () => {
    const task = makeTask({
      id: '7',
      title: 'Client call',
      category: 'freelance',
      status: 'done',
      start: ist(D, '09:00'),
      end: ist(D, '10:15'),
      originalEnd: ist(D, '10:00'),
      actualStart: ist(D, '09:05'),
      actualEnd: ist(D, '10:20'),
    })
    expect(fromItem({ id: '7', fields: toFields(task) })).toEqual(task)
  })

  test('a draft becomes a planned item with originalEnd = end', () => {
    expect(toFields({ title: 'New', start: ist(D, '09:00'), end: ist(D, '10:00'), category: 'office' })).toEqual({
      Title: 'New',
      TaskStart: ist(D, '09:00'),
      TaskEnd: ist(D, '10:00'),
      TaskOriginalEnd: ist(D, '10:00'),
      TaskActualStart: null,
      TaskActualEnd: null,
      TaskCategory: 'office',
      TaskStatus: 'planned',
    })
  })

  test("SharePoint's times without milliseconds are normalised", () => {
    const task = fromItem({
      id: '3',
      fields: {
        Title: 'x',
        TaskStart: '2026-10-17T03:30:00Z',
        TaskEnd: '2026-10-17T04:30:00Z',
        TaskOriginalEnd: '2026-10-17T04:30:00Z',
        TaskCategory: 'office',
        TaskStatus: 'planned',
      },
    })
    expect(task.start).toBe('2026-10-17T03:30:00.000Z')
    expect(task.actualStart).toBeUndefined()
    expect(task.actualEnd).toBeUndefined()
  })
})
