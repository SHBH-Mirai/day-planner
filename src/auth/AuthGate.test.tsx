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
