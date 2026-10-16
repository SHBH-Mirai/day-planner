# Day Planner v1 — design spec

Date: 2026-10-16 · Owner: Shubh · Status: draft, awaiting review

## 1. Purpose

A personal web app to plan one day across three areas of life (office job,
freelance, YouTube) and to be nudged at each task's start and end. Built for
one user with ADHD. It is also a learning project for TypeScript, React, Git
and (later) SQL.

**Done for v1:** I can plan tomorrow in under 5 minutes, every task nudges me
at its start and end while the app's tab is open, all tests pass, and the
README states the closed-tab limit.

## 2. Decisions (from the brief, 2026-10-16)

| Topic | Decision |
|---|---|
| Platform | Web app (single-page React app) |
| Users | Just me |
| Storage | SharePoint Online list in my own Microsoft 365 business tenant |
| Sign-in | Microsoft Entra ID via MSAL (in v1 scope, because SharePoint needs it) |
| Graph permission | Delegated `Sites.Selected`, granted to one site only (see 6.2) |
| Hosting | `localhost` (fixed port) and GitHub Pages |
| Repo | `day-planner`, public, on GitHub (SHBH-Mirai) |
| Style | Clean basic theme using CSS variables. Dark-mode toggle and playful polish go to the backlog |
| Build mode | "Just write it" for this whole project: Claude writes code, always test first |
| Budget | Free only |
| Deadline | None |

## 3. Scope

### In v1
1. **Task model** (section 5).
2. **Today view:** tasks on a vertical timeline in time order, coloured by
   category; add, edit, delete, mark done, skip.
3. **Validation:** end must be after start (block); overlapping tasks (warn,
   don't block); 3+ hours of back-to-back tasks with no gap (warn).
4. **Nudges while the tab is open:** one at each task's start
   ("▶ START: <task> until <end>") and end ("⏹ STOP: <task>. Done?").
   The end nudge offers Done, +15 min, Skip **in the page**. Pressing +15
   shows which later tasks now overlap or get pushed back.
5. **Saved in SharePoint**, so a refresh or a second browser shows the same
   plan after sign-in.
6. **End-of-day summary:** planned vs actual per task, and time per category.

### Out of v1 (goes into `BACKLOG.md`)
Dark-mode toggle, playful theme, recurring tasks, push notifications with the
app closed (Web Push/VAPID or an Electron tray app), mobile app, calendar
import, AI planning, settings screen, multi-day views, sharing with others.

## 4. Known hard limits (stated in the README)

- **Nudges only fire while the tab is open.** Closed-tab nudges need v2
  (backend + scheduler + Web Push, or an Electron tray app).
- **Background tabs can delay nudges by up to about a minute.** Chrome
  throttles timers on pages hidden for more than 5 minutes to roughly one
  wake-up per minute (DOCS: Chrome 88 timer-throttling post). The scheduler
  is designed around this (section 7).
- **Windows Focus Assist / Do Not Disturb can hide OS notifications.** The
  in-page banner is the backup.

## 5. Data model

```ts
type Category = "office" | "freelance" | "youtube";
type Status = "planned" | "done" | "skipped";

interface Task {
  id: string;            // SharePoint list item id
  title: string;
  start: string;         // ISO 8601 UTC, e.g. "2026-10-17T03:30:00Z"
  end: string;           // ISO 8601 UTC; moves when the task is extended
  originalEnd: string;   // end as first planned; never changes after create
  actualStart?: string;  // set when I press "Started" (or accept the start nudge)
  actualEnd?: string;    // set when I press Done
  category: Category;
  status: Status;
}
```

- All times are stored in UTC and shown in local time (IST). SharePoint
  stores date/time values in UTC (third-party docs; to be confirmed by a GET
  after the first write, because a known Graph quirk can show a shifted value
  in the create response).
- **Planned duration** = `originalEnd − start`. **Actual duration** =
  `actualEnd − actualStart` (falls back to `start` if `actualStart` is
  missing).

### SharePoint list `DayPlannerTasks`

| Column | SharePoint type | Notes |
|---|---|---|
| Title | Single line of text | built-in column |
| Start | Date and time | |
| End | Date and time | |
| OriginalEnd | Date and time | |
| ActualStart | Date and time | optional |
| ActualEnd | Date and time | optional |
| Category | Choice: office, freelance, youtube | |
| Status | Choice: planned, done, skipped | default planned |

## 6. Architecture

React single-page app built with Vite. Small modules with one job each. Only
`storage/` and `auth/` know about Microsoft.

| Module | Job | Power Apps / D365 analogy |
|---|---|---|
| `domain/` | Pure TS: validation, overlap check, no-break check, "what +15 pushes back", summary maths | Business rules / plugin logic |
| `scheduler/` | Decides which nudges are due, based on the clock and the task list | Scheduled Power Automate flow |
| `notify/` | Notification API wrapper + in-page banner | Toast notifications |
| `storage/` | `TaskRepository` interface: `SharePointTaskRepository` (Graph) and `InMemoryTaskRepository` (tests) | Dataverse Web API / connector |
| `auth/` | MSAL sign-in, silent token refresh | Connection reference |
| `ui/` | Today timeline, task form, nudge banner, summary | Canvas app screens and controls |

### 6.1 Data flow
1. On load: sign in (MSAL redirect), then `repository.listForDay(today)`.
2. UI changes call the repository, then update React state.
3. The scheduler reads the current task list and the clock and emits
   `start`/`end` events; `notify/` shows them.

### 6.2 Auth and permission
- App registration in my tenant, platform **Single-page application**,
  redirect URIs: `http://localhost:5173/` (Vite `strictPort: true`, so the
  port never drifts; this also keeps the origin stable) and the GitHub Pages URL
  (exact match, including the repo path). MSAL.js 2+ uses auth code flow with
  PKCE; implicit grant is not supported (DOCS: Microsoft Learn SPA
  registration).
- **Permission: delegated `Sites.Selected`.** It was chosen because it is
  least privilege: the app can reach only the one site I grant, and never more
  than I can do myself (DOCS: Microsoft 365 Dev Blog, delegated Sites.Selected
  supported since 2024-02-09). There is a one-time setup step: grant the app
  `write` on the site via `POST /sites/{siteId}/permissions` (for example from
  Graph Explorer as admin).
  **Fallback** if that grant step blocks us: delegated `Sites.ReadWrite.All`
  (simpler, broader).
- Client ID and tenant ID are not secrets, but they live in `.env.local`
  (gitignored) with a committed `.env.example`, so the public repo carries
  no tenant details.
- Tokens are refreshed with `acquireTokenSilent` before each Graph call, so a
  tab left open all day keeps working.
- Manual portal steps (app registration, list creation, site grant) are done
  by Shubh following written steps. Claude never signs in to the tenant.

## 7. Scheduler design (time-based logic)

- One `setInterval` tick (every 15 s). Each tick asks a pure function
  `dueNudges(tasks, now, alreadyFired)` which nudges are due. Nothing relies on
  one long `setTimeout`, so throttled or late ticks still catch up.
- A nudge fires once: fired ids (`taskId:start` / `taskId:end`) are kept in
  memory and in `sessionStorage`, so a refresh doesn't repeat them.
- If a nudge is more than 10 minutes late (for example the laptop slept), the
  app still shows it, marked "missed at HH:MM", and doesn't pop an OS
  notification.
- Notification permission is requested only from a button click (MDN: must
  come from a user gesture; Firefox enforces it since v72).
- The Notifications API needs a secure context. GitHub Pages is HTTPS, and
  `http://localhost:5173` reports `window.isSecureContext === true` in Chrome
  (DATA: checked 2026-10-16 during setup).

## 8. Validation rules

| Rule | Result |
|---|---|
| `end <= start` | Block save, inline error |
| Overlaps another non-skipped task | Warning, save allowed |
| 3h+ continuous tasks with no gap of at least 10 min | Warning on the timeline |
| Title empty | Block save |
| Task crosses midnight | Allowed; it shows on the day it starts |

## 9. Error handling

- Graph call fails: show a banner "Couldn't save. Retry", keep the change in
  the UI, and retry when I press Retry. No silent data loss.
- Signed out or token expired and silent refresh fails: show "Sign in
  again"; nudges keep running from the tasks already loaded.
- Notification permission denied: in-page banner only, plus a hint on how to
  re-enable it.

## 10. Testing (TDD: red, green, refactor)

- **Vitest** unit tests for `domain/` and `scheduler/` (using fake timers and
  a fixed "now").
- `SharePointTaskRepository` tested against a mocked `fetch`: correct URLs,
  body shape, UTC conversion, error mapping.
- **React Testing Library** for the Today view, form validation messages, and
  the nudge banner actions (Done / +15 / Skip).
- MSAL is mocked. No test touches the real tenant.
- Each feature: test cases listed in plain English, failing test shown, then
  code, then refactor. Existing tests are never changed without explaining
  why first.

## 11. Order of work

1. Setup (Claude does it): Vite + React + TS, Vitest + RTL, ESLint, `git init`,
   `.env.example`, `BACKLOG.md`, README with limits. Latest stable versions
   are checked at setup time and pinned in `package.json`.
2. `domain/` model + validation.
3. `storage/` interface + in-memory repo; Today view working locally.
4. `auth/` + `SharePointTaskRepository` (after Shubh finishes the portal steps).
5. `scheduler/` + `notify/` (fake-timer tests first).
6. Extend (+15) with the "pushes back" preview.
7. End-of-day summary.
8. GitHub Pages deploy.
9. Short review: what I learned, what v2 needs.

Commits and pushes happen only when Shubh says so.

## 12. Risks

| Risk | Mitigation |
|---|---|
| Sign-in is the hardest part for a beginner | Built after the app works locally, with the in-memory repo behind the same interface |
| `Sites.Selected` grant step is fiddly | Written steps; documented fallback permission |
| Late nudges in background tabs | Clock-comparing tick (section 7); limit stated in the README |
| Timezone bugs (IST storage, UTC SharePoint, US clients) | UTC everywhere in data, local only in the UI, edge-case tests |
| Scope creep (playful UI, extra features) | Hard cap in section 3; everything else goes to `BACKLOG.md` |
| Learning suffers in "just write it" mode | Each feature still gets a plain-English explanation of what and why |
