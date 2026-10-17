import { describe, expect, test } from 'vitest'
import type { RoutineDraft } from '../domain/routine'
import { RepositoryError } from './TaskRepository'
import type { RoutineRepository } from './RoutineRepository'

const draft = (title: string, startTime = '07:15', over: Partial<RoutineDraft> = {}): RoutineDraft => ({
  title,
  category: 'office',
  startTime,
  durationMin: 45,
  days: ['Mon', 'Wed'],
  active: true,
  ...over,
})

/** Behaviour every RoutineRepository must have. Run it against each implementation. */
export function runRoutineContract(name: string, makeRepo: () => RoutineRepository): void {
  describe(`${name} (RoutineRepository contract)`, () => {
    test('create returns the routine with an id, and lists it', async () => {
      const repo = makeRepo()
      const created = await repo.create(draft('Gym', '07:15', { category: 'youtube', days: ['Sat', 'Sun'] }))
      expect(created).toMatchObject({ title: 'Gym', category: 'youtube', startTime: '07:15', durationMin: 45, days: ['Sat', 'Sun'], active: true })
      expect(created.id).toBeTruthy()
      expect(await repo.list()).toEqual([created])
    })

    test('list is sorted by start time', async () => {
      const repo = makeRepo()
      await repo.create(draft('Evening walk', '19:00'))
      await repo.create(draft('Gym', '07:15'))
      expect((await repo.list()).map((r) => r.title)).toEqual(['Gym', 'Evening walk'])
    })

    test('update changes a routine', async () => {
      const repo = makeRepo()
      const r = await repo.create(draft('Gym'))
      await repo.update({ ...r, active: false, days: ['Fri'], durationMin: 30 })
      expect(await repo.list()).toEqual([{ ...r, active: false, days: ['Fri'], durationMin: 30 }])
    })

    test('remove deletes it, and removing a missing one is notFound', async () => {
      const repo = makeRepo()
      const r = await repo.create(draft('Gym'))
      await repo.remove(r.id)
      expect(await repo.list()).toEqual([])
      await expect(repo.remove(r.id)).rejects.toBeInstanceOf(RepositoryError)
      await expect(repo.remove(r.id)).rejects.toMatchObject({ kind: 'notFound' })
    })
  })
}
