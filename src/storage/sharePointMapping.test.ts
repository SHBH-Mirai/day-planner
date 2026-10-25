import { describe, expect, test } from 'vitest'
import { fromItem, toFields } from './sharePointMapping'
import { ist, makeTask } from '../test-utils/makeTask'

const D = '2026-10-17'

describe('SharePoint mapping', () => {
  test('a full task survives a round trip', () => {
    const task = makeTask({
      id: '7',
      title: 'Client call',
      category: 'projects',
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

describe('SharePoint mapping: descriptions', () => {
  const draft = { title: 'New', start: ist(D, '09:00'), end: ist(D, '10:00'), category: 'office' as const }
  const item = (TaskDescription: unknown) => ({
    id: '9',
    fields: { ...toFields(makeTask({ id: '9' })), TaskDescription } as Parameters<typeof fromItem>[0]['fields'],
  })

  test('a task sends its description, line breaks kept', () => {
    expect(toFields(makeTask({ description: 'a\nb' })).TaskDescription).toBe('a\nb')
  })

  test('a task without one sends null, so an update clears the column', () => {
    expect(toFields(makeTask()).TaskDescription).toBeNull()
  })

  test('a new draft sends a description only when it has one', () => {
    expect(toFields({ ...draft, description: 'Steps ✂️' }).TaskDescription).toBe('Steps ✂️')
    expect(toFields(draft)).not.toHaveProperty('TaskDescription')
  })

  test('reads the description back', () => {
    expect(fromItem(item('a\nb')).description).toBe('a\nb')
  })

  test('null, empty or missing reads as no description', () => {
    expect(fromItem(item(null))).not.toHaveProperty('description')
    expect(fromItem(item(''))).not.toHaveProperty('description')
    expect(fromItem(item(undefined))).not.toHaveProperty('description')
  })
})

describe('SharePoint mapping: category values', () => {
  const withCategory = (TaskCategory: unknown) => ({
    id: '5',
    fields: { ...toFields(makeTask({ id: '5' })), TaskCategory } as Parameters<typeof fromItem>[0]['fields'],
  })

  test('an unknown category reads as office', () => {
    expect(fromItem(withCategory('nope')).category).toBe('office')
  })
})

describe('SharePoint mapping: fixed time', () => {
  const draft = { title: 'Call', start: ist(D, '16:00'), end: ist(D, '16:30'), category: 'office' as const }
  const item = (TaskFixed: unknown) => ({
    id: '11',
    fields: { ...toFields(makeTask({ id: '11' })), TaskFixed } as Parameters<typeof fromItem>[0]['fields'],
  })

  test('a new draft sends TaskFixed only when it is fixed', () => {
    expect(toFields({ ...draft, fixed: true }).TaskFixed).toBe(true)
    expect(toFields(draft)).not.toHaveProperty('TaskFixed')
  })

  test('an update always sends it, so turning fixed off saves false', () => {
    expect(toFields(makeTask({ fixed: true })).TaskFixed).toBe(true)
    expect(toFields(makeTask()).TaskFixed).toBe(false)
  })

  test('reads fixed back; false, null or missing read as not fixed', () => {
    expect(fromItem(item(true)).fixed).toBe(true)
    for (const v of [false, null, undefined]) expect(fromItem(item(v)).fixed).toBeFalsy()
  })
})
