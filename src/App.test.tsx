import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { IPublicClientApplication } from '@azure/msal-browser'
import App from './App'

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
})
