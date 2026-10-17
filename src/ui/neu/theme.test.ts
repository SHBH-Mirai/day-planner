import { afterEach, describe, expect, it } from 'vitest'
import { followTheme, toTheme, type TeamsThemeApi } from './theme'

describe('toTheme', () => {
  it('maps the Teams default theme to light', () => {
    expect(toTheme('default', false)).toBe('light')
  })

  it('maps the Teams dark theme to dark', () => {
    expect(toTheme('dark', false)).toBe('dark')
  })

  it('maps the Teams contrast theme to contrast, even when the system prefers dark', () => {
    expect(toTheme('contrast', true)).toBe('contrast')
  })

  it('follows the system setting outside Teams', () => {
    expect(toTheme(undefined, true)).toBe('dark')
    expect(toTheme(undefined, false)).toBe('light')
  })

  it('treats an unknown Teams theme like no theme', () => {
    expect(toTheme('purple', false)).toBe('light')
  })
})

function fakeTeams(initial: string) {
  let handler: ((t: string) => void) | undefined
  const api: TeamsThemeApi = {
    getTheme: () => Promise.resolve(initial),
    onChange: (cb) => {
      handler = cb
    },
  }
  return { api, change: (t: string) => handler?.(t) }
}

function fakeMedia(matches: boolean) {
  const listeners = new Set<() => void>()
  const media = {
    matches,
    addEventListener: (_: 'change', cb: () => void) => listeners.add(cb),
    removeEventListener: (_: 'change', cb: () => void) => listeners.delete(cb),
  }
  return {
    media,
    flip(next: boolean) {
      media.matches = next
      listeners.forEach((cb) => cb())
    },
  }
}

const root = () => document.documentElement

describe('followTheme', () => {
  afterEach(() => {
    delete root().dataset.theme
  })

  it('applies the Teams theme, then follows Teams theme changes', async () => {
    const teams = fakeTeams('dark')
    followTheme(teams.api, fakeMedia(false).media)
    await Promise.resolve()
    expect(root().dataset.theme).toBe('dark')

    teams.change('contrast')
    expect(root().dataset.theme).toBe('contrast')
  })

  it('stops following Teams after unsubscribe', async () => {
    const teams = fakeTeams('default')
    const stop = followTheme(teams.api, fakeMedia(false).media)
    await Promise.resolve()
    stop()
    teams.change('dark')
    expect(root().dataset.theme).toBe('light')
  })

  it('falls back to the system setting when Teams cannot give its theme', async () => {
    const api: TeamsThemeApi = { getTheme: () => Promise.reject(new Error('not in Teams')), onChange: () => {} }
    followTheme(api, fakeMedia(true).media)
    await new Promise((r) => setTimeout(r, 0))
    expect(root().dataset.theme).toBe('dark')
  })

  it('follows the system setting in a plain browser, live', () => {
    const sys = fakeMedia(false)
    const stop = followTheme(undefined, sys.media)
    expect(root().dataset.theme).toBe('light')

    sys.flip(true)
    expect(root().dataset.theme).toBe('dark')

    stop()
    sys.flip(false)
    expect(root().dataset.theme).toBe('dark')
  })

  it('works without matchMedia (light)', () => {
    followTheme(undefined, undefined)
    expect(root().dataset.theme).toBe('light')
  })
})
