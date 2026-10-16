# Day Planner

A personal web app to plan one day across office work, freelance and YouTube,
with a nudge at each task's start and end.

## Run it

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # unit and component tests
npm run build
npm run lint
```

Copy `.env.example` to `.env.local`. `VITE_STORAGE=memory` runs without
sign-in; `sharepoint` uses a SharePoint list (see `docs/setup-microsoft.md`).

## Known limits

- **Nudges only fire while the tab is open.** Closed-tab nudges need v2
  (backend + scheduler + Web Push, or an Electron tray app).
- **Background tabs can delay nudges by up to about a minute.** Chrome
  throttles timers on pages hidden for more than 5 minutes to roughly one
  wake-up per minute.
- **Windows Focus Assist / Do Not Disturb can hide OS notifications.** The
  in-page banner is the backup.

## Stack

Versions as installed on 2026-10-16:

| Tool | Version | Why |
|---|---|---|
| Vite | 8.3 | Dev server and build |
| React | 19.2 | UI |
| TypeScript | 6.0 | Types catch mistakes before running |
| Vitest | 5.0 | Tests |
| React Testing Library | 16.3 | Tests UI the way a user clicks it |
| oxlint | 1.81 | Linting (ships with the Vite template) |

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` runs the tests, builds and deploys on every push to
`main`. One-time setup in the repo's GitHub settings:

1. **Settings → Pages → Source: GitHub Actions.**
2. **Settings → Secrets and variables → Actions → Variables:** add `VITE_STORAGE`
   (`sharepoint`), `VITE_AAD_CLIENT_ID`, `VITE_AAD_TENANT_ID`, `VITE_SP_SITE_ID`,
   `VITE_SP_LIST_ID`, and optionally `VITE_GRAPH_SCOPE`.
3. Add `https://shbh-mirai.github.io/day-planner/` as an SPA redirect URI on the
   app registration (see `docs/setup-microsoft.md`).

Note: a browser app can't hide its config. The client ID, tenant ID and site
ID end up in the published JavaScript. That's normal for single-page apps;
access is still protected by Microsoft sign-in and the site permission.
