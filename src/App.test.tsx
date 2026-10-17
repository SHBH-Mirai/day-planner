import { describe, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { IPublicClientApplication } from '@azure/msal-browser'
import App from './App'
import { SignInRedirectError } from './auth/msal'

describe('App', () => {
  test('memory storage opens straight to Today, with no sign-in', async () => {
    render(<App env={{ VITE_STORAGE: 'memory' }} />)
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign in with Microsoft' })).not.toBeInTheDocument()
  })

  test('memory storage warns that nothing is saved', async () => {
    render(<App env={{}} />)
    expect(await screen.findByText(/Not saved: memory mode/)).toBeInTheDocument()
  })

  test('sharepoint storage asks to sign in when nobody is signed in', async () => {
    const client = {
      getActiveAccount: () => null,
      getAllAccounts: () => [],
      loginRedirect: vi.fn(async () => {}),
    } as unknown as IPublicClientApplication
    render(<App env={{ VITE_STORAGE: 'sharepoint', VITE_SP_SITE_ID: 's', VITE_SP_LIST_ID: 'l' }} createClient={async () => client} />)
    expect(await screen.findByRole('button', { name: 'Sign in with Microsoft' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Today' })).not.toBeInTheDocument()
  })

  test('shows a message when Microsoft sign-in cannot start', async () => {
    render(
      <App
        env={{ VITE_STORAGE: 'sharepoint' }}
        createClient={async () => {
          throw new Error('bad config')
        }}
      />,
    )
    expect(await screen.findByText(/Couldn.t start Microsoft sign-in/)).toBeInTheDocument()
  })

  test('a sign-in that did not finish (e.g. consent cancelled) offers to try again', async () => {
    const client = { loginRedirect: vi.fn(async () => {}) } as unknown as IPublicClientApplication
    render(
      <App
        env={{ VITE_STORAGE: 'sharepoint' }}
        createClient={async () => {
          throw new SignInRedirectError(client, new Error('user_cancelled'))
        }}
      />,
    )
    expect(await screen.findByText(/Sign-in didn.t finish/)).toBeInTheDocument()
    expect(screen.queryByText(/VITE_AAD/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sign in with Microsoft' }))
    expect(client.loginRedirect).toHaveBeenCalledOnce()
  })
})

describe('App inside Teams', () => {
  test('creates the Microsoft client for the Teams host', async () => {
    const client = {
      getActiveAccount: () => null,
      getAllAccounts: () => [],
      loginRedirect: vi.fn(async () => {}),
    } as unknown as IPublicClientApplication
    const createClient = vi.fn(async () => client)
    render(<App env={{ VITE_STORAGE: 'sharepoint' }} createClient={createClient} detect={async () => 'teams'} />)
    await screen.findByRole('button', { name: 'Sign in with Microsoft' })
    expect(createClient).toHaveBeenCalledWith(expect.anything(), 'teams')
  })

  test('follows the Teams theme', async () => {
    const client = {
      getActiveAccount: () => null,
      getAllAccounts: () => [],
      loginRedirect: vi.fn(async () => {}),
    } as unknown as IPublicClientApplication
    const teamsTheme = () => ({ getTheme: async () => 'dark', onChange: () => {} })
    render(
      <App
        env={{ VITE_STORAGE: 'sharepoint' }}
        createClient={async () => client}
        detect={async () => 'teams'}
        teamsTheme={teamsTheme}
      />,
    )
    await screen.findByRole('button', { name: 'Sign in with Microsoft' })
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'))
  })
})

describe('App theme', () => {
  test('memory storage puts a theme on the page', async () => {
    delete document.documentElement.dataset.theme
    render(<App env={{ VITE_STORAGE: 'memory' }} />)
    await screen.findByRole('heading', { name: 'Today' })
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})

describe('App Setup', () => {
  test('memory mode has a gear that opens Setup', async () => {
    render(<App env={{ VITE_STORAGE: 'memory' }} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Setup' }))
    expect(await screen.findByRole('region', { name: 'Setup' })).toBeInTheDocument()
  })
})
