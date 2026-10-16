/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STORAGE?: 'memory' | 'sharepoint'
  readonly VITE_AAD_CLIENT_ID?: string
  readonly VITE_AAD_TENANT_ID?: string
  readonly VITE_SP_SITE_ID?: string
  readonly VITE_SP_LIST_ID?: string
  /** Optional. Defaults to Sites.Selected; set to the Sites.ReadWrite.All URL for the fallback. */
  readonly VITE_GRAPH_SCOPE?: string
}
