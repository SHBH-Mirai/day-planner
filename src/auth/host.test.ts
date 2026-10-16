import { afterEach, describe, expect, test, vi } from 'vitest'
import { detectHost } from './host'

afterEach(() => vi.useRealTimers())

describe('detectHost', () => {
  test('is teams when Teams initialises', async () => {
    await expect(detectHost(async () => {})).resolves.toBe('teams')
  })

  test('is browser when Teams initialisation fails', async () => {
    await expect(detectHost(async () => { throw new Error('not in Teams') })).resolves.toBe('browser')
  })

  test('is browser after the timeout when Teams never answers', async () => {
    vi.useFakeTimers()
    const result = detectHost(() => new Promise(() => {}), 1500)
    await vi.advanceTimersByTimeAsync(1500)
    await expect(result).resolves.toBe('browser')
  })
})
