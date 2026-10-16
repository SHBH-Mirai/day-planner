import { describe, expect, test, vi } from 'vitest'
import { InteractionRequiredAuthError, type AccountInfo } from '@azure/msal-browser'
import { getAccessToken, type TokenClient } from './msal'

const SCOPES = ['https://graph.microsoft.com/Sites.Selected']
const account = { homeAccountId: 'h', username: 'shubh@example.com' } as AccountInfo

function fakeClient(overrides: Partial<TokenClient> = {}): TokenClient {
  return {
    getActiveAccount: vi.fn(() => account),
    getAllAccounts: vi.fn(() => [account]),
    acquireTokenSilent: vi.fn(async () => ({ accessToken: 'token-123' })),
    acquireTokenRedirect: vi.fn(async () => {}),
    ...overrides,
  } as TokenClient
}

describe('getAccessToken', () => {
  test('returns the token from a silent request', async () => {
    const client = fakeClient()
    await expect(getAccessToken(client, SCOPES)).resolves.toBe('token-123')
    expect(client.acquireTokenSilent).toHaveBeenCalledWith({ scopes: SCOPES, account })
  })

  // Changed 2026-10-16 with Shubh's OK (review finding I5): no redirect mid-save; the UI offers "Sign in again".
  test('when interaction is required it rejects with auth and does not redirect', async () => {
    const client = fakeClient({
      acquireTokenSilent: vi.fn(async () => {
        throw new InteractionRequiredAuthError('interaction_required', 'corr-1')
      }),
    })
    await expect(getAccessToken(client, SCOPES)).rejects.toMatchObject({ kind: 'auth' })
    expect(client.acquireTokenRedirect).not.toHaveBeenCalled()
  })

  test('other failures become an auth RepositoryError without redirecting', async () => {
    const client = fakeClient({
      acquireTokenSilent: vi.fn(async () => {
        throw new Error('network down')
      }),
    })
    await expect(getAccessToken(client, SCOPES)).rejects.toMatchObject({ kind: 'auth' })
    expect(client.acquireTokenRedirect).not.toHaveBeenCalled()
  })

  // Changed 2026-10-16 with Shubh's OK (review finding I5): same rule, no redirect from inside a save.
  test('with no signed-in account it rejects with auth and does not redirect', async () => {
    const client = fakeClient({ getActiveAccount: vi.fn(() => null), getAllAccounts: vi.fn(() => []) })
    await expect(getAccessToken(client, SCOPES)).rejects.toMatchObject({ kind: 'auth' })
    expect(client.acquireTokenRedirect).not.toHaveBeenCalled()
  })
})
