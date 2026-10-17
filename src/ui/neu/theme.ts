import { app } from '@microsoft/teams-js'

export type Theme = 'light' | 'dark' | 'contrast'

/** The two things we need from Teams; a seam so tests don't need TeamsJS. */
export interface TeamsThemeApi {
  getTheme(): Promise<string | undefined>
  onChange(cb: (teamsTheme: string) => void): void
}

/** The slice of MediaQueryList we use, so tests can pass a fake. */
export interface DarkQuery {
  matches: boolean
  addEventListener(type: 'change', cb: () => void): void
  removeEventListener(type: 'change', cb: () => void): void
}

/** Teams' theme name wins; outside Teams (or an unknown name) the system setting decides. */
export function toTheme(teamsTheme: string | undefined, prefersDark: boolean): Theme {
  if (teamsTheme === 'dark' || teamsTheme === 'contrast') return teamsTheme
  if (teamsTheme === 'default') return 'light'
  return prefersDark ? 'dark' : 'light'
}

function systemDark(): DarkQuery | undefined {
  return typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : undefined
}

/**
 * Keeps `<html data-theme>` in step with Teams (when given) or the system setting.
 * Returns a function that stops following.
 */
export function followTheme(teams?: TeamsThemeApi, media: DarkQuery | undefined = systemDark()): () => void {
  const root = document.documentElement
  let active = true
  const apply = (teamsTheme: string | undefined) => {
    if (active) root.dataset.theme = toTheme(teamsTheme, media?.matches ?? false)
  }

  if (teams) {
    apply(undefined)
    teams.getTheme().then(apply, () => apply(undefined))
    try {
      teams.onChange(apply)
    } catch {
      // TeamsJS not ready: keep the theme we have rather than break the app.
    }
    return () => {
      active = false
    }
  }

  const onSystemChange = () => apply(undefined)
  apply(undefined)
  media?.addEventListener('change', onSystemChange)
  return () => {
    active = false
    media?.removeEventListener('change', onSystemChange)
  }
}

/** The real Teams wiring. Only call it once `detectHost` says we're in Teams. */
export function teamsThemeApi(): TeamsThemeApi {
  return {
    getTheme: () => Promise.resolve().then(() => app.getContext()).then((c) => c.app.theme),
    onChange: (cb) => app.registerOnThemeChangeHandler(cb),
  }
}
