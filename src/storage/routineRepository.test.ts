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

  test('fills gaps: no category is office, no days is none, no Active is active', () => {
    expect(fromRoutineItem({ id: '8', fields: { Title: 'Read', StartTime: '21:00', DurationMin: 30 } })).toEqual({
      id: '8',
      title: 'Read',
      category: 'office',
      startTime: '21:00',
      durationMin: 30,
      days: [],
      active: true,
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
