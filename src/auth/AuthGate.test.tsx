import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AccountInfo } from '@azure/msal-browser'
import { AuthGate, type SignInClient } from './AuthGate'

const SCOPES = ['https://graph.microsoft.com/Sites.Selected']

function client(account: AccountInfo | null): SignInClient {
  return {
    getActiveAccount: vi.fn(() => account),
    getAllAccounts: vi.fn(() => (account ? [account] : [])),
    loginRedirect: vi.fn(async () => {}),
  }
}

describe('AuthGate', () => {
  test('shows a sign-in button when nobody is signed in', async () => {
    const c = client(null)
    render(<AuthGate client={c} scopes={SCOPES}>secret planner</AuthGate>)
    expect(screen.queryByText('secret planner')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in with Microsoft' }))
    expect(c.loginRedirect).toHaveBeenCalledWith({ scopes: SCOPES })
  })

  test('shows the app once signed in', () => {
    render(
      <AuthGate client={client({ username: 'shubh@example.com' } as AccountInfo)} scopes={SCOPES}>
        secret planner
      </AuthGate>,
    )
    expect(screen.getByText('secret planner')).toBeInTheDocument()
  })
})

describe('AuthGate with a custom sign-in (Teams popup)', () => {
  test('uses it and shows the app once it resolves', async () => {
    let account: AccountInfo | null = null
    const c: SignInClient = {
      getActiveAccount: vi.fn(() => account),
      getAllAccounts: vi.fn(() => (account ? [account] : [])),
      loginRedirect: vi.fn(async () => {}),
    }
    const signIn = vi.fn(async () => {
      account = { username: 'shubh@example.com' } as AccountInfo
    })
    render(<AuthGate client={c} scopes={SCOPES} signIn={signIn}>secret planner</AuthGate>)
    await userEvent.click(screen.getByRole('button', { name: 'Sign in with Microsoft' }))
    expect(signIn).toHaveBeenCalledOnce()
    expect(c.loginRedirect).not.toHaveBeenCalled()
    expect(await screen.findByText('secret planner')).toBeInTheDocument()
  })
})
