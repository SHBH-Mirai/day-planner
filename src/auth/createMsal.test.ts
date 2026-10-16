import { describe, expect, test, vi } from 'vitest'
import { createMsal, SignInRedirectError } from './msal'

const client = {
  handleRedirectPromise: vi.fn(),
  getActiveAccount: () => null,
  getAllAccounts: () => [],
  setActiveAccount: vi.fn(),
}

vi.mock('@azure/msal-browser', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@azure/msal-browser')>()),
  createStandardPublicClientApplication: async () => client,
}))

const config = { clientId: 'c', tenantId: 't', redirectUri: 'http://localhost/', scopes: ['s'] }

describe('createMsal', () => {
  test('a failed return from the sign-in redirect rejects with SignInRedirectError holding the client', async () => {
    client.handleRedirectPromise.mockRejectedValueOnce(new Error('user_cancelled'))
    const err = await createMsal(config).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(SignInRedirectError)
    expect((err as SignInRedirectError).client).toBe(client)
  })
})
