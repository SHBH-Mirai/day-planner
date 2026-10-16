import { app } from '@microsoft/teams-js'

export type Host = 'teams' | 'browser'

/**
 * Are we running inside Teams? Teams answers TeamsJS initialisation quickly;
 * a normal browser tab never does, so we give up after `timeoutMs`.
 */
export async function detectHost(init: () => Promise<unknown> = () => app.initialize(), timeoutMs = 1500): Promise<Host> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<Host>((resolve) => {
    timer = setTimeout(() => resolve('browser'), timeoutMs)
  })
  const attempt = init().then(
    (): Host => 'teams',
    (): Host => 'browser',
  )
  try {
    return await Promise.race([attempt, timeout])
  } finally {
    clearTimeout(timer)
  }
}
