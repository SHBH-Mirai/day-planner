import { describe, expect, test, vi } from 'vitest'
import { detectHostIfFramed } from './host'

describe('detectHostIfFramed', () => {
  test('a top-level page is a browser at once, without asking Teams', async () => {
    const detect = vi.fn(async () => 'teams' as const)
    await expect(detectHostIfFramed(() => false, detect)).resolves.toBe('browser')
    expect(detect).not.toHaveBeenCalled()
  })

  test('a framed page asks Teams', async () => {
    await expect(detectHostIfFramed(() => true, async () => 'teams')).resolves.toBe('teams')
  })
})
