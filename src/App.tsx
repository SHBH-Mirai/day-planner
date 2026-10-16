import { useEffect, useMemo, useState } from 'react'
import type { IPublicClientApplication } from '@azure/msal-browser'
import { AuthGate } from './auth/AuthGate'
import { authConfigFromEnv, createMsal, getAccessToken, type AppEnv, type AuthConfig } from './auth/msal'
import { InMemoryTaskRepository } from './storage/InMemoryTaskRepository'
import { SharePointTaskRepository } from './storage/SharePointTaskRepository'
import { TodayView } from './ui/TodayView'

interface Props {
  env?: AppEnv
  createClient?: (config: AuthConfig) => Promise<IPublicClientApplication>
}

function App({ env = import.meta.env, createClient = createMsal }: Props) {
  // Fixed at page load. A tab left open past midnight keeps showing yesterday until refresh.
  const [day] = useState(() => new Date())
  if (env.VITE_STORAGE !== 'sharepoint') return <MemoryApp day={day} />
  return <SharePointApp day={day} env={env} createClient={createClient} />
}

function MemoryApp({ day }: { day: Date }) {
  const [repo] = useState(() => new InMemoryTaskRepository())
  return <TodayView repo={repo} day={day} />
}

function SharePointApp({ day, env, createClient }: { day: Date; env: AppEnv; createClient: NonNullable<Props['createClient']> }) {
  const config = useMemo(() => authConfigFromEnv(env), [env])
  const [client, setClient] = useState<IPublicClientApplication | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    createClient(config).then(setClient, () => setFailed(true))
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
      <TodayView repo={repo} day={day} />
    </AuthGate>
  )
}

export default App
