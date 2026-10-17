import { describe, expect, test } from 'vitest'
import { DEFAULT_SETTINGS, type SettingsRepository } from './SettingsRepository'

/** Behaviour every SettingsRepository must have. Run it against each implementation. */
export function runSettingsContract(name: string, makeRepo: () => SettingsRepository): void {
  describe(`${name} (SettingsRepository contract)`, () => {
    test('with nothing saved, get returns the defaults', async () => {
      expect(await makeRepo().get()).toEqual(DEFAULT_SETTINGS)
    })

    test('save then get returns what was saved', async () => {
      const repo = makeRepo()
      await repo.save({ startNudges: false, endNudges: true, defaultLengthMin: 45 })
      expect(await repo.get()).toEqual({ startNudges: false, endNudges: true, defaultLengthMin: 45 })
    })

    test('a second save replaces the first', async () => {
      const repo = makeRepo()
      await repo.save({ startNudges: false, endNudges: false, defaultLengthMin: 15 })
      await repo.save({ startNudges: true, endNudges: false, defaultLengthMin: 90 })
      expect(await repo.get()).toEqual({ startNudges: true, endNudges: false, defaultLengthMin: 90 })
    })
  })
}
