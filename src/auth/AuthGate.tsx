import type { ReactNode } from 'react'
import type { IPublicClientApplication } from '@azure/msal-browser'

export type SignInClient = Pick<IPublicClientApplication, 'getActiveAccount' | 'getAllAccounts' | 'loginRedirect'>

interface Props {
  client: SignInClient
  scopes: string[]
  children: ReactNode
}

/** Shows children only when someone is signed in. Sign-in leaves the page and comes back. */
export function AuthGate({ client, scopes, children }: Props) {
  const account = client.getActiveAccount() ?? client.getAllAccounts()[0]
  if (account) return <>{children}</>

  return (
    <main className="today sign-in">
      <h1>Day Planner</h1>
      <p className="muted">Your plan is saved in your SharePoint list, so sign in first.</p>
      <button className="primary" onClick={() => void client.loginRedirect({ scopes })}>
        Sign in with Microsoft
      </button>
    </main>
  )
}
