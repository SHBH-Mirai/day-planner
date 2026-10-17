import {
  createNestablePublicClientApplication,
  createStandardPublicClientApplication,
  InteractionRequiredAuthError,
  type AccountInfo,
  type IPublicClientApplication,
} from '@azure/msal-browser'
import { RepositoryError } from '../storage/TaskRepository'
import type { Host } from './host'

/** The part of the MSAL client that getAccessToken uses (keeps tests small). */
export type TokenClient = Pick<
  IPublicClientApplication,
  'getActiveAccount' | 'getAllAccounts' | 'acquireTokenSilent' | 'acquireTokenRedirect' | 'acquireTokenPopup'
>

export interface AuthConfig {
  clientId: string
  tenantId: string
  redirectUri: string
  scopes: string[]
}

export type AppEnv = Partial<
  Pick<
    ImportMetaEnv,
    | 'VITE_STORAGE'
    | 'VITE_AAD_CLIENT_ID'
    | 'VITE_AAD_TENANT_ID'
    | 'VITE_SP_SITE_ID'
    | 'VITE_SP_LIST_ID'
    | 'VITE_SP_SETTINGS_LIST_ID'
    | 'VITE_SP_TEMPLATES_LIST_ID'
    | 'VITE_GRAPH_SCOPE'
  >
>

/** Reads auth settings from VITE_* env vars. The scope can be switched to the fallback without code changes. */
export function authConfigFromEnv(env: AppEnv = import.meta.env): AuthConfig {
  return {
    clientId: env.VITE_AAD_CLIENT_ID ?? '',
    tenantId: env.VITE_AAD_TENANT_ID ?? '',
    redirectUri: window.location.origin + import.meta.env.BASE_URL,
    scopes: [env.VITE_GRAPH_SCOPE || 'https://graph.microsoft.com/Sites.Selected'],
  }
}

/** Coming back from Microsoft sign-in failed (e.g. consent cancelled). MSAL itself started fine, so you can try again. */
export class SignInRedirectError extends Error {
  readonly client: IPublicClientApplication

  constructor(client: IPublicClientApplication, cause: unknown) {
    super("Sign-in didn't finish", { cause })
    this.client = client
    this.name = 'SignInRedirectError'
  }
}

/**
 * Creates and initialises MSAL.
 * Browser: finishes a sign-in redirect if we're coming back from one.
 * Teams: uses nested app auth (MSAL v5's nestable factory switches it on by itself)
 * and tries a silent sign-in through Teams; if that fails the sign-in button shows.
 */
export async function createMsal(config: AuthConfig, host: Host = 'browser'): Promise<IPublicClientApplication> {
  if (host === 'teams') {
    const client = await createNestablePublicClientApplication({
      auth: { clientId: config.clientId, authority: `https://login.microsoftonline.com/${config.tenantId}` },
    })
    let account: AccountInfo | null = client.getActiveAccount() ?? client.getAllAccounts()[0] ?? null
    if (!account) {
      account = await client.ssoSilent({ scopes: config.scopes }).then(
        (r) => r.account,
        () => null,
      )
    }
    client.setActiveAccount(account)
    return client
  }

  const client = await createStandardPublicClientApplication({
    auth: {
      clientId: config.clientId,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
      redirectUri: config.redirectUri,
    },
    cache: { cacheLocation: 'localStorage' },
  })
  const result = await client.handleRedirectPromise().catch((e: unknown) => {
    throw new SignInRedirectError(client, e)
  })
  const account = result?.account ?? client.getActiveAccount() ?? client.getAllAccounts()[0] ?? null
  client.setActiveAccount(account)
  return client
}

/**
 * A Graph access token, fetched silently (refreshes quietly in a long-open tab).
 * Never navigates away: when Microsoft needs you to sign in again it rejects
 * with an 'auth' RepositoryError, and the UI offers "Sign in again".
 */
export async function getAccessToken(client: TokenClient, scopes: string[]): Promise<string> {
  const account = client.getActiveAccount() ?? client.getAllAccounts()[0]
  if (!account) throw new RepositoryError('auth', 'Not signed in')
  try {
    const result = await client.acquireTokenSilent({ scopes, account })
    return result.accessToken
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) throw new RepositoryError('auth', 'Sign-in expired')
    throw new RepositoryError('auth', error instanceof Error ? error.message : 'Sign-in failed')
  }
}

/**
 * Signs you in again. Browser: sends you to Microsoft and back.
 * Teams: a popup, because a redirect would break inside the Teams frame.
 */
export async function signInAgain(client: TokenClient, scopes: string[], host: Host = 'browser'): Promise<void> {
  const account = client.getActiveAccount() ?? client.getAllAccounts()[0]
  const request = account ? { scopes, account } : { scopes }
  if (host === 'teams') {
    await client.acquireTokenPopup(request)
    return
  }
  return client.acquireTokenRedirect(request)
}
