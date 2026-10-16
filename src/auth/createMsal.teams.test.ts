import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createMsal } from './msal'

const account = { homeAccountId: 'h', username: 'shubh@example.com' }
const nested = {
  getActiveAccount: vi.fn(() => null),
  getAllAccounts: vi.fn((): unknown[] => []),
  setActiveAccount: vi.fn(),
  ssoSilent: vi.fn(async () => ({ account })),
  handleRedirectPromise: vi.fn(),
}
const standard = { ...nested, handleRedirectPromise: vi.fn(async () => null) }
const createNestable = vi.fn(async (_config: unknown) => nested)
const createStandard = vi.fn(async (_config: unknown) => standard)

vi.mock('@azure/msal-browser', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@azure/msal-browser')>()),
  createNestablePublicClientApplication: (config: unknown) => createNestable(config),
  createStandardPublicClientApplication: (config: unknown) => createStandard(config),
}))

const config = { clientId: 'c', tenantId: 't', redirectUri: 'http://localhost/', scopes: ['s'] }

beforeEach(() => vi.clearAllMocks())

describe('createMsal inside Teams', () => {
  test('uses the nestable client (MSAL v5 turns nested app auth on by itself)', async () => {
    await createMsal(config, 'teams')
    expect(createNestable).toHaveBeenCalledWith(
      expect.objectContaining({ auth: expect.objectContaining({ clientId: 'c' }) }),
    )
    expect(createStandard).not.toHaveBeenCalled()
    expect(nested.handleRedirectPromise).not.toHaveBeenCalled()
  })

  test('with no cached account it signs in silently through Teams', async () => {
    await createMsal(config, 'teams')
    expect(nested.ssoSilent).toHaveBeenCalledWith({ scopes: ['s'] })
    expect(nested.setActiveAccount).toHaveBeenLastCalledWith(account)
  })

  test('a failed silent sign-in is not fatal (the sign-in button shows instead)', async () => {
    nested.ssoSilent.mockRejectedValueOnce(new Error('interaction_required'))
    await expect(createMsal(config, 'teams')).resolves.toBe(nested)
  })

  test('in a browser it keeps the standard redirect client', async () => {
    await createMsal(config)
    expect(createStandard).toHaveBeenCalled()
    expect(createNestable).not.toHaveBeenCalled()
  })
})
