import { useEffect, useMemo, useState } from 'react'
import type { IPublicClientApplication } from '@azure/msal-browser'
import { AuthGate } from './auth/AuthGate'
import {
  authConfigFromEnv,
  createMsal,
  getAccessToken,
  signInAgain,
  SignInRedirectError,
  type AppEnv,
  type AuthConfig,
} from './auth/msal'
import { detectHostIfFramed, type Host } from './auth/host'
import { InMemoryRoutineRepository } from './storage/InMemoryRoutineRepository'
import { InMemorySettingsRepository } from './storage/InMemorySettingsRepository'
import { InMemoryTaskRepository } from './storage/InMemoryTaskRepository'
import { SharePointRoutineRepository } from './storage/SharePointRoutineRepository'
import { SharePointSettingsRepository } from './storage/SharePointSettingsRepository'
import { SharePointTaskRepository } from './storage/SharePointTaskRepository'
import { followTheme, teamsThemeApi, type TeamsThemeApi } from './ui/neu/theme'
import { TodayView } from './ui/TodayView'
import { useToday } from './ui/useToday'

interface Props {
  env?: AppEnv
  createClient?: (config: AuthConfig, host?: Host) => Promise<IPublicClientApplication>
  /** Where are we running? Default: Teams if framed and Teams answers, else browser. */
  detect?: () => Promise<Host>
  /** Teams theme source, used only when running in Teams. */
  teamsTheme?: () => TeamsThemeApi
}

function App({
  env = import.meta.env,
  createClient = createMsal,
  detect = detectHostIfFramed,
  teamsTheme = teamsThemeApi,
}: Props) {
  const day = useToday()
  if (env.VITE_STORAGE !== 'sharepoint') return <MemoryApp day={day} />
  return <SharePointApp day={day} env={env} createClient={createClient} detect={detect} teamsTheme={teamsTheme} />
}

function MemoryApp({ day }: { day: Date }) {
  const [repo] = useState(() => new InMemoryTaskRepository())
  const [settingsRepo] = useState(() => new InMemorySettingsRepository())
  const [routineRepo] = useState(() => new InMemoryRoutineRepository())
  useEffect(() => followTheme(), [])
  // Loud on purpose: a deploy missing VITE_STORAGE=sharepoint lands here.
  return (
    <>
      <div className="banner banner-warning memory-banner" role="alert">
        Not saved: memory mode. Tasks disappear when you close or refresh this tab.
      </div>
      <TodayView repo={repo} day={day} settingsRepo={settingsRepo} routineRepo={routineRepo} />
    </>
  )
}

function SharePointApp({
  day,
  env,
  createClient,
  detect,
  teamsTheme,
}: {
  day: Date
  env: AppEnv
  createClient: NonNullable<Props['createClient']>
  detect: NonNullable<Props['detect']>
  teamsTheme: NonNullable<Props['teamsTheme']>
}) {
  const config = useMemo(() => authConfigFromEnv(env), [env])
  const [client, setClient] = useState<IPublicClientApplication | null>(null)
  const [failed, setFailed] = useState<false | 'config' | SignInRedirectError>(false)

  const [host, setHost] = useState<Host>('browser')

  useEffect(() => {
    detect()
      .then((h) => {
        setHost(h)
        return createClient(config, h)
      })
      .then(setClient, (e: unknown) => setFailed(e instanceof SignInRedirectError ? e : 'config'))
  }, [createClient, detect, config])

  useEffect(() => followTheme(host === 'teams' ? teamsTheme() : undefined), [host, teamsTheme])

  const repos = useMemo(() => {
    if (!client) return null
    const list = (listId: string | undefined) => ({
      siteId: env.VITE_SP_SITE_ID ?? '',
      listId: listId ?? '',
      getToken: () => getAccessToken(client, config.scopes),
    })
    return {
      tasks: new SharePointTaskRepository(list(env.VITE_SP_LIST_ID)),
      settings: new SharePointSettingsRepository(list(env.VITE_SP_SETTINGS_LIST_ID)),
      routines: new SharePointRoutineRepository(list(env.VITE_SP_TEMPLATES_LIST_ID)),
    }
  }, [client, config, env])
  const repo = repos?.tasks

  if (failed instanceof SignInRedirectError) {
    return (
      <main className="today">
        <div className="banner banner-error" role="alert">
          Sign-in didn't finish, so nothing was loaded.{' '}
          <button className="primary" onClick={() => void failed.client.loginRedirect({ scopes: config.scopes })}>
            Sign in with Microsoft
          </button>
        </div>
      </main>
    )
  }
  if (failed) {
    return (
      <main className="today">
        <div className="banner banner-error" role="alert">
          Couldn't start Microsoft sign-in. Check the VITE_AAD_* values in .env.local.
        </div>
      </main>
    )
  }
  if (!client || !repo) return <main className="today muted">Loading…</main>

  return (
    <AuthGate
      client={client}
      scopes={config.scopes}
      signIn={
        host === 'teams'
          ? () => client.loginPopup({ scopes: config.scopes }).then((r) => client.setActiveAccount(r.account))
          : undefined
      }
    >
      <TodayView
        repo={repo}
        day={day}
        settingsRepo={repos?.settings}
        routineRepo={repos?.routines}
        inTeams={host === 'teams'}
        onSignInAgain={() => void signInAgain(client, config.scopes, host)}
      />
    </AuthGate>
  )
}

export default App
