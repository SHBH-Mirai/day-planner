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
import { InMemoryTaskRepository } from './storage/InMemoryTaskRepository'
import { SharePointTaskRepository } from './storage/SharePointTaskRepository'
import { TodayView } from './ui/TodayView'
import { useToday } from './ui/useToday'

interface Props {
  env?: AppEnv
  createClient?: (config: AuthConfig) => Promise<IPublicClientApplication>
}

function App({ env = import.meta.env, createClient = createMsal }: Props) {
  const day = useToday()
  if (env.VITE_STORAGE !== 'sharepoint') return <MemoryApp day={day} />
  return <SharePointApp day={day} env={env} createClient={createClient} />
}

function MemoryApp({ day }: { day: Date }) {
  const [repo] = useState(() => new InMemoryTaskRepository())
  // Loud on purpose: a deploy missing VITE_STORAGE=sharepoint lands here.
  return (
    <>
      <div className="banner banner-warning memory-banner" role="alert">
        Not saved: memory mode. Tasks disappear when you close or refresh this tab.
      </div>
      <TodayView repo={repo} day={day} />
    </>
  )
}

function SharePointApp({ day, env, createClient }: { day: Date; env: AppEnv; createClient: NonNullable<Props['createClient']> }) {
  const config = useMemo(() => authConfigFromEnv(env), [env])
  const [client, setClient] = useState<IPublicClientApplication | null>(null)
  const [failed, setFailed] = useState<false | 'config' | SignInRedirectError>(false)

  useEffect(() => {
    createClient(config).then(setClient, (e: unknown) => setFailed(e instanceof SignInRedirectError ? e : 'config'))
  }, [createClient, config])

  const repo = useMemo(
    () =>
      client &&
      new SharePointTaskRepository({
        siteId: env.VITE_SP_SITE_ID ?? '',
        listId: env.VITE_SP_LIST_ID ?? '',
        getToken: () => getAccessToken(client, config.scopes),
      }),
    [client, config, env],
  )

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
    <AuthGate client={client} scopes={config.scopes}>
      <TodayView repo={repo} day={day} onSignInAgain={() => void signInAgain(client, config.scopes)} />
    </AuthGate>
  )
}

export default App
