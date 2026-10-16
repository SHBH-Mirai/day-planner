import {
  createStandardPublicClientApplication,
  InteractionRequiredAuthError,
  type IPublicClientApplication,
} from '@azure/msal-browser'
import { RepositoryError } from '../storage/TaskRepository'

/** The part of the MSAL client that getAccessToken uses (keeps tests small). */
export type TokenClient = Pick<
  IPublicClientApplication,
  'getActiveAccount' | 'getAllAccounts' | 'acquireTokenSilent' | 'acquireTokenRedirect'
>

export interface AuthConfig {
  clientId: string
  tenantId: string
  redirectUri: string
  scopes: string[]
}

export type AppEnv = Partial<
  Pick<ImportMetaEnv, 'VITE_STORAGE' | 'VITE_AAD_CLIENT_ID' | 'VITE_AAD_TENANT_ID' | 'VITE_SP_SITE_ID' | 'VITE_SP_LIST_ID' | 'VITE_GRAPH_SCOPE'>
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

/** Creates and initialises MSAL, and finishes a sign-in redirect if we're coming back from one. */
export async function createMsal(config: AuthConfig): Promise<IPublicClientApplication> {
  const client = await createStandardPublicClientApplication({
    auth: {
      clientId: config.clientId,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
      redirectUri: config.redirectUri,
    },
    cache: { cacheLocation: 'localStorage' },
  })
  const result = await client.handleRedirectPromise()
  const account = result?.account ?? client.getActiveAccount() ?? client.getAllAccounts()[0] ?? null
  client.setActiveAccount(account)
  return client
}

/**
 * A Graph access token. Silent first (refreshes quietly in a long-open tab);
 * when Microsoft needs you to sign in again, it redirects and this rejects.
 */
export async function getAccessToken(client: TokenClient, scopes: string[]): Promise<string> {
  const account = client.getActiveAccount() ?? client.getAllAccounts()[0]
  if (!account) {
    await client.acquireTokenRedirect({ scopes })
    throw new RepositoryError('auth', 'Signing in')
  }
  try {
    const result = await client.acquireTokenSilent({ scopes, account })
    return result.accessToken
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      await client.acquireTokenRedirect({ scopes, account })
      throw new RepositoryError('auth', 'Signing in again')
    }
    throw new RepositoryError('auth', error instanceof Error ? error.message : 'Sign-in failed')
  }
}
