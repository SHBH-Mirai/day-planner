# Day Planner in Teams — design spec

Date: 2026-10-17 · Owner: Shubh · Status: draft, awaiting approval

## Goal

Open Day Planner **inside Microsoft Teams**: it gets its own icon in the Teams left
sidebar, and the "Open Day Planner" button on the nudge cards opens it there
instead of in a browser. The same app keeps working in a normal browser.

## Facts this rests on

- DOCS ([Teams NAA][naa]): nested app authentication (NAA) is for SPAs such as
  tabs. It needs only MSAL.js; you don't use the TeamsJS `getAuthToken` call.
- DOCS ([naa]): the app registration needs an extra **Single-page application**
  redirect URI `brk-multihub://<domain>`, origin only. For us that's
  `brk-multihub://shbh-mirai.github.io`.
- DOCS ([naa]): use `createNestablePublicClientApplication` with
  `auth.supportsNestedAppAuth: true`, and **initialise TeamsJS before MSAL**. When a
  silent token request fails, use `acquireTokenPopup`, not redirect.
- CODE: the installed `@azure/msal-browser` 5.25.1 exports
  `createNestablePublicClientApplication`.
- DOCS ([nav]): a personal-tab deep link has the form
  `https://teams.microsoft.com/l/entity/<appId>/<entityId>`. In an Adaptive Card,
  `Action.OpenUrl` with that link opens the tab inside Teams.
- GUESS, to verify while building: how to detect "running inside Teams". The plan is
  TeamsJS `app.initialize()`, with a short timeout as the browser fallback.

## Design

### 1. App code (test-first)
- New `src/auth/host.ts`: `detectHost(): Promise<'teams' | 'browser'>`. It tries
  TeamsJS `app.initialize()` with a timeout and returns `'browser'` if that fails.
- `createMsal`:
  - **browser**: unchanged (standard client, redirect sign-in).
  - **teams**: `createNestablePublicClientApplication({ auth: { clientId,
    authority, supportsNestedAppAuth: true } })`. Signing in and "Sign in again"
    use `acquireTokenPopup` / `loginPopup`.
- `AuthGate` and the "Sign in again" banner call one `signIn()` that picks
  redirect or popup by host. Inside Teams it is usually silent (SSO).
- **New runtime dependency: `@microsoft/teams-js`.** The v1 plan said new
  dependencies need Shubh's OK. This spec asks for it.

### 2. Teams app package (`teams-app/`)
- `manifest.json`: the current manifest schema version (checked while building). It has:
  - a personal `staticTabs` entry: `entityId: "today"`,
    `contentUrl` = the Pages URL, scope `personal`;
  - `validDomains: ["shbh-mirai.github.io"]`;
  - `webApplicationInfo.id` = the client ID.
- Two icons: `color.png` 192×192 and `outline.png` 32×32, simple and generated.
- A build script zips the three files into `teams-app/day-planner.zip`.

### 3. Shubh's steps (security and admin, so his)
- Entra: add the SPA redirect URI `brk-multihub://shbh-mirai.github.io`.
- Teams: Apps → Manage your apps → **Upload an app** → `day-planner.zip`
  (custom app upload must be allowed; he is the tenant admin), then pin it.

### 4. Flow change (Claude, in Power Automate)
- The cards' "Open Day Planner" `Action.OpenUrl` becomes the Teams deep link
  `https://teams.microsoft.com/l/entity/<teamsAppId>/today`. `teamsAppId` is the
  ID Teams assigns after upload.

## Tests
- `detectHost`: resolves `'teams'` when initialise succeeds, and `'browser'` on
  timeout or error (TeamsJS mocked).
- `createMsal`: uses the nestable factory when the host is `teams`, and the standard
  one otherwise (both mocked).
- `signIn`: popup in Teams, redirect in browser.
- Existing tests unchanged.

## Out of scope
- Teams channel and meeting tabs (personal app only).
- Outlook and M365 app hosting, which NAA also supports but we don't need yet.
- Token prefetch (manifest `nestedAppAuthInfo`): a later optimisation.

## Risks
- The detection approach is a GUESS. If TeamsJS initialise is slow in the
  browser, the timeout delays the first paint slightly.
- Custom app upload could be blocked by tenant policy. Shubh is admin and can
  allow it in the Teams admin center.

[naa]: https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/authentication/nested-authentication
[nav]: https://learn.microsoft.com/en-za/MicrosoftTeams/platform/tabs/how-to/tab-navigation
