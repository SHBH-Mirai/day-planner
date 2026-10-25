import { describe, expect, test } from 'vitest'
import type { TaskDraft } from '../domain/task'
import { RepositoryError, type TaskRepository } from './TaskRepository'
import { ist } from '../test-utils/makeTask'

const DAY = new Date('2026-10-17T12:00:00+05:30')
const draft = (title: string, from = '09:00', to = '10:00', day = '2026-10-17'): TaskDraft => ({
  title,
  start: ist(day, from),
  end: ist(day, to),
  category: 'office',
})

/** Behaviour every TaskRepository must have. Run it against each implementation. */
export function runRepositoryContract(name: string, makeRepo: () => TaskRepository): void {
  describe(`${name} (TaskRepository contract)`, () => {
    test('create returns a planned task with originalEnd = end, and lists it', async () => {
      const repo = makeRepo()
      const created = await repo.create(draft('Standup'))
      expect(created).toMatchObject({ title: 'Standup', status: 'planned', originalEnd: created.end })
      expect(created.id).toBeTruthy()
      expect(await repo.listForDay(DAY)).toEqual([created])
    })

    test('listForDay is sorted by start and skips other days', async () => {
      const repo = makeRepo()
      const late = await repo.create(draft('Late', '15:00', '16:00'))
      const early = await repo.create(draft('Early', '08:00', '09:00'))
      await repo.create(draft('Tomorrow', '09:00', '10:00', '2026-10-18'))
      expect((await repo.listForDay(DAY)).map((t) => t.id)).toEqual([early.id, late.id])
    })

    test('update saves changes', async () => {
      const repo = makeRepo()
      const created = await repo.create(draft('Old'))
      await repo.update({ ...created, title: 'New', status: 'done' })
      expect(await repo.listForDay(DAY)).toEqual([{ ...created, title: 'New', status: 'done' }])
    })

    test('create and update keep the description; clearing removes it', async () => {
      const repo = makeRepo()
      const created = await repo.create({ ...draft('Edit video'), description: 'Steps ✂️' })
      expect((await repo.listForDay(DAY))[0].description).toBe('Steps ✂️')
      await repo.update({ ...created, description: 'New' })
      expect((await repo.listForDay(DAY))[0].description).toBe('New')
      await repo.update({ ...created, description: undefined })
      expect((await repo.listForDay(DAY))[0].description).toBeUndefined()
    })

    test('listRange returns the days asked for, in start order, and nothing outside them', async () => {
      const repo = makeRepo()
      const late17 = await repo.create(draft('Late 17', '21:00', '22:00'))
      const early18 = await repo.create(draft('Early 18', '06:00', '07:00', '2026-10-18'))
      const early17 = await repo.create(draft('Early 17', '00:00', '01:00'))
      await repo.create(draft('Midnight 19', '00:00', '00:30', '2026-10-19'))
      await repo.create(draft('Before 17', '23:30', '23:59', '2026-10-16'))
      expect((await repo.listRange(DAY, 2)).map((t) => t.id)).toEqual([early17.id, late17.id, early18.id])
      expect(await repo.listRange(DAY, 1)).toEqual(await repo.listForDay(DAY))
    })

    test('fixed time is saved, and turning it off saves that too', async () => {
      const repo = makeRepo()
      const created = await repo.create({ ...draft('Call', '16:00', '16:30'), fixed: true })
      expect((await repo.listForDay(DAY))[0].fixed).toBe(true)
      await repo.update({ ...created, fixed: false })
      expect((await repo.listForDay(DAY))[0].fixed).toBeFalsy()
    })

    test('remove deletes', async () => {
      const repo = makeRepo()
      const created = await repo.create(draft('Gone'))
      await repo.remove(created.id)
      expect(await repo.listForDay(DAY)).toEqual([])
    })

    test('update and remove of an unknown id reject with notFound', async () => {
      const repo = makeRepo()
      const ghost = { ...(await repo.create(draft('x'))), id: 'missing' }
      await expect(repo.update(ghost)).rejects.toMatchObject({ kind: 'notFound' })
      await expect(repo.remove('missing')).rejects.toBeInstanceOf(RepositoryError)
    })
  })
}
