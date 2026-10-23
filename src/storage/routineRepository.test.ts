import { describe, expect, test } from 'vitest'
import { runRoutineContract } from './routineContract'
import { InMemoryRoutineRepository } from './InMemoryRoutineRepository'
import { SharePointRoutineRepository } from './SharePointRoutineRepository'
import { fromRoutineItem, toRoutineFields } from './routineMapping'
import { fakeListGraph } from '../test-utils/fakeListGraph'

const LIST = 'templates-list'
const sharePoint = (graph = fakeListGraph()) => ({
  graph,
  repo: new SharePointRoutineRepository({ siteId: 'site', listId: LIST, getToken: async () => 'tok', fetchFn: graph.fetchFn }),
})

runRoutineContract('InMemoryRoutineRepository', () => new InMemoryRoutineRepository())
runRoutineContract('SharePointRoutineRepository', () => sharePoint().repo)

describe('routine mapping', () => {
  test('writes the Templates columns, with Days as a multi-choice collection', () => {
    expect(
      toRoutineFields({ title: 'Gym', category: 'freelance', startTime: '07:15', durationMin: 45, days: ['Mon', 'Fri'], active: false }),
    ).toEqual({
      Title: 'Gym',
      Category: 'freelance',
      StartTime: '07:15',
      DurationMin: 45,
      'Days@odata.type': 'Collection(Edm.String)',
      Days: ['Mon', 'Fri'],
      Active: false,
    })
  })

  test('reads an item back, keeping only valid days in week order', () => {
    expect(
      fromRoutineItem({
        id: '7',
        fields: { Title: 'Gym', Category: 'youtube', StartTime: '18:00', DurationMin: 60, Days: ['Sun', 'Mon', 'Funday'], Active: true },
      }),
    ).toEqual({ id: '7', title: 'Gym', category: 'youtube', startTime: '18:00', durationMin: 60, days: ['Mon', 'Sun'], active: true })
  })

  test('fills gaps: no category is office, no days is none, no Active is off (as the Morning flow sees it)', () => {
    expect(fromRoutineItem({ id: '8', fields: { Title: 'Read', StartTime: '21:00', DurationMin: 30 } })).toEqual({
      id: '8',
      title: 'Read',
      category: 'office',
      startTime: '21:00',
      durationMin: 30,
      days: [],
      active: false,
    })
  })
})

describe('SharePointRoutineRepository', () => {
  test('update sends the routine columns to that item', async () => {
    const { graph, repo } = sharePoint()
    const r = await repo.create({ title: 'Gym', category: 'office', startTime: '07:15', durationMin: 45, days: ['Mon'], active: true })
    await repo.update({ ...r, active: false })
    const patch = graph.requests.find((q) => q.method === 'PATCH')
    expect(patch?.url).toContain(`/items/${r.id}/fields`)
    expect(patch?.body).toMatchObject({ Active: false, Days: ['Mon'], 'Days@odata.type': 'Collection(Edm.String)' })
  })
})

describe('SharePointRoutineRepository setActive', () => {
  test('pauses a routine by writing only Active', async () => {
    const { graph, repo } = sharePoint()
    const r = await repo.create({ title: 'Gym', category: 'office', startTime: '07:15', durationMin: 45, days: ['Mon'], active: true })
    await repo.setActive(r.id, false)
    const patch = graph.requests.find((q) => q.method === 'PATCH')
    expect(patch?.body).toEqual({ Active: false })
    expect((await repo.list())[0]).toMatchObject({ active: false, days: ['Mon'], startTime: '07:15' })
  })
})

describe('routine mapping: descriptions', () => {
  const draft = { title: 'Gym', category: 'office' as const, startTime: '07:15', durationMin: 45, days: ['Mon' as const], active: true }
  const item = (Description: unknown) => ({ id: '7', fields: { Title: 'Gym', Category: 'office', StartTime: '07:15', DurationMin: 45, Days: ['Mon'], Active: true, Description } })

  test('a new routine sends its description only when it has one', () => {
    expect(toRoutineFields({ ...draft, description: 'Scene, record' }).Description).toBe('Scene, record')
    expect(toRoutineFields(draft)).not.toHaveProperty('Description')
  })

  test('an update always sends it, null when there is none, so clearing works', () => {
    expect(toRoutineFields(draft, 'update').Description).toBeNull()
    expect(toRoutineFields({ ...draft, description: 'x' }, 'update').Description).toBe('x')
  })

  test('reads the description back, line breaks kept', () => {
    expect(fromRoutineItem(item('a\nb')).description).toBe('a\nb')
  })

  test('null, empty, missing or not text reads as no description', () => {
    for (const v of [null, '', undefined, 42]) expect(fromRoutineItem(item(v))).not.toHaveProperty('description')
  })
})
