import { describe, expect, test } from 'vitest'
import { runSettingsContract } from './settingsContract'
import { InMemorySettingsRepository } from './InMemorySettingsRepository'
import { SharePointSettingsRepository } from './SharePointSettingsRepository'
import { fakeListGraph } from '../test-utils/fakeListGraph'

const SITE = 'site'
const LIST = 'settings-list'
const sharePoint = (graph = fakeListGraph()) => ({
  graph,
  repo: new SharePointSettingsRepository({ siteId: SITE, listId: LIST, getToken: async () => 'tok', fetchFn: graph.fetchFn }),
})

runSettingsContract('InMemorySettingsRepository', () => new InMemorySettingsRepository())
runSettingsContract('SharePointSettingsRepository', () => sharePoint().repo)

describe('SharePointSettingsRepository', () => {
  test('reads the existing row, ignoring the columns the flows own', async () => {
    const { graph, repo } = sharePoint()
    graph.seed(LIST, { Title: 'Shubh', StartNudges: false, EndNudges: true, DefaultLengthMin: 60, FiredKeys: 'x', TimeZone: 'India Standard Time' })
    expect(await repo.get()).toEqual({ startNudges: false, endNudges: true, defaultLengthMin: 60 })
  })

  test('uses the first row when there are several', async () => {
    const { graph, repo } = sharePoint()
    graph.seed(LIST, { StartNudges: true, EndNudges: false, DefaultLengthMin: 15 })
    graph.seed(LIST, { StartNudges: false, EndNudges: false, DefaultLengthMin: 90 })
    expect(await repo.get()).toEqual({ startNudges: true, endNudges: false, defaultLengthMin: 15 })
  })

  test('saving writes only the three app fields, to the existing row', async () => {
    const { graph, repo } = sharePoint()
    const id = graph.seed(LIST, { StartNudges: true, EndNudges: true, DefaultLengthMin: 30, FiredKeys: 'keep-me' })
    await repo.save({ startNudges: false, endNudges: true, defaultLengthMin: 45 })
    const patch = graph.requests.find((r) => r.method === 'PATCH')
    expect(patch?.url).toContain(`/items/${id}/fields`)
    expect(patch?.body).toEqual({ StartNudges: false, EndNudges: true, DefaultLengthMin: 45 })
    expect(graph.items(LIST)).toHaveLength(1)
    expect(graph.items(LIST)[0].fields.FiredKeys).toBe('keep-me')
  })

  test('with no row yet, the first save creates exactly one', async () => {
    const { graph, repo } = sharePoint()
    await repo.save({ startNudges: true, endNudges: false, defaultLengthMin: 60 })
    expect(graph.requests.filter((r) => r.method === 'POST')).toHaveLength(1)
    expect(graph.items(LIST)).toHaveLength(1)
  })

  test('missing or odd values read as the defaults', async () => {
    const { graph, repo } = sharePoint()
    graph.seed(LIST, { Title: 'x' })
    expect(await repo.get()).toEqual({ startNudges: true, endNudges: true, defaultLengthMin: 30 })
  })
})
