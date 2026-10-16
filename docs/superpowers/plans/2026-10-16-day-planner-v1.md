# Day Planner v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A one-day planner web app that saves tasks to a SharePoint list and nudges at each task's start and end while the tab is open.

**Architecture:** React SPA (Vite). Pure-TS `domain/` and `scheduler/` hold all the rules and are fully unit-tested. `storage/` hides SharePoint behind a `TaskRepository` interface, with an in-memory version used for tests and local dev. `auth/` wraps MSAL. The UI is built and tested against the in-memory repo before Microsoft is wired in.

**Tech Stack:** Vite, React, TypeScript (strict), Vitest + React Testing Library + jsdom, ESLint, `@azure/msal-browser`, Microsoft Graph REST (plain `fetch`), GitHub Pages via GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-16-day-planner-design.md`

## Global Constraints

- TypeScript `strict: true`. No `any` in `src/` except inside test mocks.
- Dev server `http://localhost:5173/`, Vite `server.strictPort: true`.
- Production base path `/day-planner/` (GitHub Pages project site).
- All stored times: ISO 8601 UTC strings ending in `Z`. Local time only in the UI.
- `Category` = `"office" | "freelance" | "youtube"`; `Status` = `"planned" | "done" | "skipped"`.
- Nudge copy, exact: start `▶ START: <title> until <HH:MM>`, end `⏹ STOP: <title>. Done?` (local 24h `HH:MM`).
- Scheduler tick: 15 000 ms. "Missed" threshold: more than 10 minutes late.
- No-break warning: 3 hours or more of tasks where every gap is under 10 minutes. Skipped tasks are ignored.
- Extend button: +15 minutes.
- Env vars (in `.env.local`, gitignored; `.env.example` committed): `VITE_STORAGE` (`memory` | `sharepoint`), `VITE_AAD_CLIENT_ID`, `VITE_AAD_TENANT_ID`, `VITE_SP_SITE_ID`, `VITE_SP_LIST_ID`.
- Graph permission: delegated `Sites.Selected` (fallback `Sites.ReadWrite.All`, only if the grant step fails).
- New runtime dependencies allowed: `react`, `react-dom`, `@azure/msal-browser`. Anything else needs Shubh's OK.
- Git: commit or push only when Shubh says "commit" / "push". Every "Commit" step below means: show the message, wait for the word.
- No existing test is edited, weakened, skipped or deleted without explaining why to Shubh first.

## Review Focus

1. **Extending a task re-arms its end nudge.** After +15, the STOP nudge fires again at the new end, exactly once. Pinned in Task 8 (`nudgeKey` includes the time).
2. **Editing a task's start time after its start nudge fired** re-arms the start nudge at the new time. Pinned in Task 8.
3. **Laptop wakes after sleeping past several tasks.** Each overdue nudge is returned once, flagged `missed`, and no OS notification is sent. Pinned in Tasks 8 and 9.
4. **Task that starts at 23:30 local and ends after midnight** appears on the day it starts and not on the next day, using IST day boundaries rather than UTC ones. Pinned in Task 2.
5. **Done or skipped tasks, and deleted tasks,** never nudge, even if their time comes later. Pinned in Task 8.

---

### Task 1: Project setup (Claude does it directly)

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/setupTests.ts`, `src/smoke.test.ts`, `.gitignore`, `.env.example`, `BACKLOG.md`, `README.md`, `eslint.config.js`

**Interfaces:**
- Produces: `npm run dev` (port 5173), `npm test` (Vitest, jsdom, RTL matchers), `npm run build`, `npm run lint`.

- [ ] **Step 1:** Scaffold with `npm create vite@latest . -- --template react-ts` inside `day-planner/` (the folder already holds `docs/`; keep it). Check the current stable versions on npm and record them in the README "Stack" section.
- [ ] **Step 2:** Add dev deps `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`. In `vite.config.ts`: `server: { port: 5173, strictPort: true }`, `base: process.env.GITHUB_ACTIONS ? '/day-planner/' : '/'`, `test: { environment: 'jsdom', setupFiles: './src/setupTests.ts' }`.
- [ ] **Step 3:** Pin tests to IST: `src/test/globalSetup.ts` sets `process.env.TZ = 'Asia/Kolkata'`, registered as `test.globalSetup`. (UNVERIFIED that workers pick this up; the smoke test proves it.) `src/smoke.test.ts`: `expect(new Date('2026-10-17T00:00:00Z').getTimezoneOffset()).toBe(-330)`. Run `npx vitest run`. Expected: 1 passed. If it fails, set TZ in the `test` npm script instead and re-run.
- [ ] **Step 4:** Write `.gitignore` (include `.env.local`), `.env.example` (all env var names, empty values, `VITE_STORAGE=memory`), `BACKLOG.md` (spec section 3 "Out of v1" list), `README.md` (purpose, run commands, the three known limits from spec section 4, word for word).
- [ ] **Step 5:** `npm run dev`. In the browser console, run `window.isSecureContext` on `http://localhost:5173`. Record the result in the spec, section 7 (this replaces the UNVERIFIED note). Expected: `true`.
- [ ] **Step 6:** `git init`, set branch `main`. Commit message: `chore: scaffold Vite React TS app with Vitest`.

### Task 2: Task model and day helpers

**Files:**
- Create: `src/domain/task.ts`, `src/domain/time.ts`
- Test: `src/domain/time.test.ts`

**Interfaces:**
- Produces:
  - `type Category`, `type Status`, `interface Task` exactly as spec section 5.
  - `type TaskDraft = Pick<Task, 'title' | 'start' | 'end' | 'category'>`
  - `dayBounds(day: Date): { fromUtc: string; toUtc: string }`: local midnight to next local midnight, as UTC ISO.
  - `tasksForDay(tasks: Task[], day: Date): Task[]`: tasks whose `start` falls inside `dayBounds(day)`, sorted by `start`.
  - `formatLocalTime(iso: string): string` returns `HH:MM` in 24h local time.
  - `minutesBetween(fromIso: string, toIso: string): number`

- [ ] **Step 1: Failing tests** (IST comes from Task 1's global setup):
  - `dayBounds(new Date('2026-10-17T10:00:00+05:30'))` → `{ fromUtc: '2026-10-16T18:30:00.000Z', toUtc: '2026-10-17T18:30:00.000Z' }`
  - `tasksForDay`: a task starting `2026-10-17T23:30+05:30` and ending `2026-10-18T00:30+05:30` is included for 17 Oct and excluded for 18 Oct. *(Review Focus 4)*
  - `tasksForDay` returns tasks sorted by start.
  - `formatLocalTime('2026-10-17T03:30:00Z')` → `'09:00'`
  - `minutesBetween('…T03:30:00Z', '…T04:15:00Z')` → `45`
- [ ] **Step 2:** `npx vitest run src/domain/time.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3:** Implement with the built-in `Date` and `Intl.DateTimeFormat` only (no date library).
- [ ] **Step 4:** Run again. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(domain): task model and day helpers`.

### Task 3: Validation

**Files:**
- Create: `src/domain/validate.ts`
- Test: `src/domain/validate.test.ts`

**Interfaces:**
- Consumes: `Task`, `TaskDraft`, `formatLocalTime`, `minutesBetween` (Task 2).
- Produces:
  - `validateTask(draft: TaskDraft, others: Task[], editingId?: string): { errors: string[]; warnings: string[] }`
  - `findNoBreakRuns(tasks: Task[]): { fromUtc: string; toUtc: string }[]`

- [ ] **Step 1: Failing tests:**
  - empty or whitespace-only title → errors contain `'Title is required'`
  - `end === start` and `end < start` → errors contain `'End must be after start'`
  - overlapping a non-skipped task titled "Standup" → warnings contain `'Overlaps Standup (09:00–09:15)'`, and errors are empty
  - an overlap with a skipped task, or with itself (`editingId`), gives no warning
  - touching ends (A ends 10:00, B starts 10:00) is not an overlap
  - `findNoBreakRuns`: 09:00–10:00, 10:05–11:00, 11:05–12:00 → one run 09:00–12:00. The same tasks with a 10-minute gap at 10:00 → no run. Skipped tasks break nothing and count for nothing.
- [ ] **Step 2:** Run `npx vitest run src/domain/validate.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. For the no-break check: sort non-skipped tasks by start, merge any whose gap is under 10 minutes, and return merged runs of 180 minutes or more.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(domain): task validation and no-break warning`.

### Task 4: Extend (+15) and its knock-on effects

**Files:**
- Create: `src/domain/extend.ts`
- Test: `src/domain/extend.test.ts`

**Interfaces:**
- Consumes: `Task` (Task 2).
- Produces: `extendTask(task: Task, minutes: number, all: Task[]): { updated: Task; affected: Task[] }`. `updated.end` moves forward and `originalEnd` stays the same. `affected` = other non-skipped, non-done tasks whose `start` is earlier than the new `end` and later than or equal to the old `end`, sorted by start.

- [ ] **Step 1: Failing tests:** extending 09:00–10:00 by 15 → end 10:15, `originalEnd` still 10:00. A task at 10:00 is affected; a task at 10:30 is not. Extending twice → end 10:30 and `originalEnd` still 10:00. A done task at 10:00 is not affected.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement (pure; never mutate the inputs).
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(domain): extend task with knock-on preview`.

### Task 5: End-of-day summary

**Files:**
- Create: `src/domain/summary.ts`
- Test: `src/domain/summary.test.ts`

**Interfaces:**
- Consumes: `Task`, `minutesBetween`.
- Produces: `summarize(tasks: Task[]): { perTask: { id: string; title: string; status: Status; plannedMin: number; actualMin: number | null }[]; perCategory: Record<Category, number> }`
  - `plannedMin` = `originalEnd − start`
  - `actualMin` = `actualEnd − (actualStart ?? start)` when `actualEnd` exists, otherwise `null`
  - `perCategory` adds up `actualMin` for done tasks, `plannedMin` for planned tasks, and 0 for skipped tasks. All three keys are always present.

- [ ] **Step 1: Failing tests:** one done task (planned 60, actualStart +5, actualEnd +80 → actual 75); one planned task (60); one skipped task (30) → `perCategory` sums as defined, and the skipped task counts 0. With no tasks → every category is 0.
- [ ] **Step 2:** Run. Expected: FAIL.  **Step 3:** Implement.  **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(domain): end-of-day summary`.

### Task 6: Repository interface and in-memory repo

**Files:**
- Create: `src/storage/TaskRepository.ts`, `src/storage/InMemoryTaskRepository.ts`, `src/storage/repositoryContract.ts`
- Test: `src/storage/InMemoryTaskRepository.test.ts`

**Interfaces:**
- Consumes: `Task`, `TaskDraft`, `dayBounds`.
- Produces:
  ```ts
  interface TaskRepository {
    listForDay(day: Date): Promise<Task[]>;   // sorted by start
    create(draft: TaskDraft): Promise<Task>;   // status 'planned', originalEnd = end
    update(task: Task): Promise<Task>;
    remove(id: string): Promise<void>;
  }
  type RepositoryErrorKind = 'network' | 'auth' | 'notFound' | 'unknown';
  class RepositoryError extends Error { constructor(kind: RepositoryErrorKind, message?: string); readonly kind: RepositoryErrorKind }
  runRepositoryContract(name: string, makeRepo: () => TaskRepository): void  // shared describe() block
  ```

- [ ] **Step 1: Failing contract tests:** create → listForDay includes it with `status 'planned'` and `originalEnd === end`; update changes the title; remove → gone; `update` or `remove` of an unknown id rejects with `RepositoryError` of kind `'notFound'`; a task on another day is not listed.
- [ ] **Step 2:** Run. Expected: FAIL.  **Step 3:** Implement `InMemoryTaskRepository` (ids via `crypto.randomUUID()`).  **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(storage): repository interface and in-memory repo`.

### Task 7: Today view, task form, task actions

**Files:**
- Create: `src/ui/TodayView.tsx`, `src/ui/TaskForm.tsx`, `src/ui/TaskCard.tsx`, `src/ui/SummaryView.tsx`, `src/ui/useTasks.ts`, `src/ui/theme.css`
- Modify: `src/App.tsx`
- Test: `src/ui/TodayView.test.tsx`, `src/ui/TaskForm.test.tsx`, `src/ui/SummaryView.test.tsx`

**Interfaces:**
- Consumes: `TaskRepository`, `validateTask`, `findNoBreakRuns`, `tasksForDay`, `formatLocalTime`, `summarize`.
- Produces: `useTasks(repo: TaskRepository, day: Date): { tasks: Task[]; error: RepositoryError | null; add(d: TaskDraft): Promise<void>; save(t: Task): Promise<void>; remove(id: string): Promise<void>; retry(): void }`; `<TodayView repo={...} />`.

- [ ] **Step 1: Failing RTL tests** (using `InMemoryTaskRepository`):
  - tasks render in time order with title, `HH:MM–HH:MM`, and a `data-category` attribute
  - submitting the form with end before start shows `End must be after start`, and nothing is saved
  - an overlap shows the warning text, and Save still works
  - Done sets the status and `actualEnd`; Started sets `actualStart`; Skip sets `skipped`; Delete removes the card after `confirm()` (mocked to true)
  - a repo whose `create` rejects shows `Couldn't save. Retry`, and the typed task stays visible
  - a 3h no-break run shows a warning marker
  - the "Summary" button opens `SummaryView`: one row per task showing planned and actual minutes (`—` when actual is `null`), plus a minutes total per category
- [ ] **Step 2:** Run `npx vitest run src/ui`. Expected: FAIL.
- [ ] **Step 3:** Implement. Category colours as CSS variables in `theme.css` (`--cat-office`, `--cat-freelance`, `--cat-youtube`). No dark-mode toggle.
- [ ] **Step 4:** Run. Expected: PASS. Then `npm run dev` with `VITE_STORAGE=memory`: add 3 tasks by hand and check that the timeline looks right.
- [ ] **Step 5:** Commit: `feat(ui): today view with add, edit, delete, done, skip`.

### Task 8: Scheduler

**Files:**
- Create: `src/scheduler/dueNudges.ts`, `src/scheduler/startScheduler.ts`
- Test: `src/scheduler/dueNudges.test.ts`, `src/scheduler/startScheduler.test.ts`

**Interfaces:**
- Consumes: `Task`.
- Produces:
  ```ts
  type Nudge = { key: string; kind: 'start' | 'end'; task: Task; missed: boolean };
  nudgeKey(task: Task, kind: 'start' | 'end'): string   // `${id}:${kind}:${kind === 'start' ? start : end}`
  dueNudges(tasks: Task[], now: Date, fired: ReadonlySet<string>): Nudge[]
  startScheduler(opts: { getTasks: () => Task[]; onNudge: (n: Nudge) => void; tickMs?: number; storage?: Storage }): () => void  // returns stop()
  ```
  A nudge is due when its time ≤ `now` and its key isn't in `fired`. `missed` = `now − time > 10 min`. Only tasks with `status === 'planned'` nudge. Fired keys persist in `storage` (default `sessionStorage`) under `dp.fired`.

- [ ] **Step 1: Failing tests for `dueNudges`:**
  - at start − 1 s → none; at start → one `start`; with that key in `fired` → none
  - extend (new `end`) after the end nudge fired → a new `end` nudge is due at the new end *(Review Focus 1)*
  - start edited to later after the start nudge fired → due again at the new start *(Review Focus 2)*
  - `now` 2 h after three tasks' starts → three nudges, all with `missed: true` *(Review Focus 3)*
  - done or skipped tasks → none; a task missing from the list → none *(Review Focus 5)*
- [ ] **Step 2: Failing tests for `startScheduler`** using `vi.useFakeTimers()` and `vi.setSystemTime()`: `onNudge` is called once when the clock passes start; it is not called again on later ticks; after `stop()` there are no more calls; a new scheduler with the same `storage` doesn't repeat a fired nudge (refresh case).
- [ ] **Step 3:** Run `npx vitest run src/scheduler`. Expected: FAIL.
- [ ] **Step 4:** Implement: a `setInterval` at `tickMs ?? 15000`; on each tick, call `dueNudges`, fire each nudge, record its key.
- [ ] **Step 5:** Run. Expected: PASS.
- [ ] **Step 6:** Commit: `feat(scheduler): clock-comparing nudge scheduler`.

### Task 9: Notifications and nudge banner

**Files:**
- Create: `src/notify/notify.ts`, `src/ui/NudgeBanner.tsx`
- Modify: `src/ui/TodayView.tsx` (mounts the scheduler and the banner)
- Test: `src/notify/notify.test.ts`, `src/ui/NudgeBanner.test.tsx`

**Interfaces:**
- Consumes: `Nudge`, `startScheduler`, `extendTask`, `useTasks`, `formatLocalTime`.
- Produces: `requestNotificationPermission(): Promise<NotificationPermission>` (called only from a button handler); `showOsNotification(n: Nudge): boolean` (returns false when it doesn't fire); `nudgeText(n: Nudge): string`; `<NudgeBanner nudges onStarted onDone onExtend onSkip onDismiss />`.

- [ ] **Step 1: Failing tests:**
  - `nudgeText` start → `▶ START: Write proposal until 10:00`; end → `⏹ STOP: Write proposal. Done?`
  - `showOsNotification` with permission `'granted'` constructs a `Notification` (mocked global); with `'denied'` → false; when `missed` → false and no `Notification` *(Review Focus 3)*
  - the banner shows `missed at HH:MM` for missed nudges
  - an end nudge shows Done, +15 min, Skip; +15 calls `onExtend`, and the banner then lists the affected task titles ("Pushes back: Lunch")
  - a start nudge shows a Started button
  - with permission `'default'`, an "Enable notifications" button appears; clicking it calls `requestNotificationPermission`
- [ ] **Step 2:** Run. Expected: FAIL.  **Step 3:** Implement.  **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Manual: on `npm run dev`, create a task starting 1 minute from now. Check the OS notification and the banner, then press +15 and check the pushed-back list.
- [ ] **Step 6:** Commit: `feat(notify): OS notifications and in-page nudge banner`.

### Task 10: Microsoft setup guide and auth module

**Files:**
- Create: `docs/setup-microsoft.md`, `src/auth/msal.ts`, `src/auth/AuthGate.tsx`
- Test: `src/auth/msal.test.ts`

**Interfaces:**
- Produces: `getAccessToken(): Promise<string>` (scope `https://graph.microsoft.com/Sites.Selected`; uses `acquireTokenSilent`, and on `InteractionRequiredAuthError` calls `acquireTokenRedirect`; any other failure → `RepositoryError('auth')`); `<AuthGate>{children}</AuthGate>` (shows "Sign in with Microsoft" until there's an account, and "Sign in again" after an auth error).

- [ ] **Step 1:** Fetch the current Microsoft Learn pages for: SPA app registration, delegated `Sites.Selected`, the `POST /sites/{siteId}/permissions` body, and list column indexing. Write `docs/setup-microsoft.md` as numbered portal steps for Shubh:
  1. create a site, then the list `DayPlannerTasks` with the spec section 5 columns
  2. index the `Start` column
  3. register the app (SPA platform, both redirect URIs)
  4. add delegated `Sites.Selected` and grant admin consent
  5. grant the app `write` on the site
  6. find the site ID and list ID and copy them into `.env.local`

  Each step names the Learn page it came from.
- [ ] **Step 2: Failing tests** (mock `@azure/msal-browser`): a silent success returns the token; `InteractionRequiredAuthError` triggers `acquireTokenRedirect`; a network error rejects with `RepositoryError` kind `'auth'`.
- [ ] **Step 3:** Run. Expected: FAIL.  **Step 4:** Implement.  **Step 5:** Run. Expected: PASS.
- [ ] **Step 6:** Commit: `feat(auth): MSAL sign-in and token helper`.
- [ ] **Step 7 (Shubh):** follow `docs/setup-microsoft.md`. Claude waits; Claude never signs in to the tenant.

### Task 11: SharePoint repository

**Files:**
- Create: `src/storage/SharePointTaskRepository.ts`, `src/storage/sharePointMapping.ts`
- Test: `src/storage/sharePointMapping.test.ts`, `src/storage/SharePointTaskRepository.test.ts`

**Interfaces:**
- Consumes: `TaskRepository`, `RepositoryError`, `runRepositoryContract`, `getAccessToken`, `dayBounds`.
- Produces: `new SharePointTaskRepository({ siteId, listId, getToken, fetchFn = fetch })`; `toFields(t: Task | TaskDraft): Record<string, unknown>`; `fromItem(item: GraphListItem): Task`.

- [ ] **Step 1: Failing mapping tests:** round-trip `fromItem(toFields(task))` keeps every field; optional fields that are missing stay `undefined`; dates leave as UTC `Z` strings.
- [ ] **Step 2: Failing repo tests:** run `runRepositoryContract` against a fake `fetchFn` that holds items in memory. Also check that `listForDay` calls `GET …/sites/{siteId}/lists/{listId}/items?$expand=fields&$filter=…Start ge '<fromUtc>' and …Start lt '<toUtc>'` with a `Bearer` header; that a 401 response gives kind `'auth'`, 404 gives `'notFound'`, and a fetch throw gives `'network'`; and that the repo follows `@odata.nextLink` pages.
- [ ] **Step 3:** Run. Expected: FAIL.
- [ ] **Step 4:** Implement. Check the exact `$filter` syntax for list item fields against Graph docs while doing this step.
- [ ] **Step 5:** Run. Expected: PASS.
- [ ] **Step 6:** Commit: `feat(storage): SharePoint repository via Microsoft Graph`.

### Task 12: Wire it together and test against the real tenant

**Files:**
- Modify: `src/main.tsx`, `src/App.tsx`
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: everything above. `VITE_STORAGE=memory` → `InMemoryTaskRepository` with no `AuthGate`; `sharepoint` → `AuthGate` plus `SharePointTaskRepository`.

- [ ] **Step 1: Failing test:** with `VITE_STORAGE=memory` the Today view renders without a sign-in button; with `sharepoint` (MSAL mocked, no account) the sign-in button renders.
- [ ] **Step 2:** Run. Expected: FAIL.  **Step 3:** Implement.  **Step 4:** Run `npx vitest run`. Expected: all PASS. `npm run lint` and `npm run build` both clean.
- [ ] **Step 5 (manual, real tenant):** sign in; add a task, refresh, and it's still there; check that the SharePoint list shows the UTC times; confirm with a GET that the stored times are correct (the known Graph create-response quirk); Done, +15 and Skip all write back to the list.
- [ ] **Step 6:** Commit: `feat: wire SharePoint storage and sign-in`.

### Task 13: GitHub Pages deploy

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `README.md`

- [ ] **Step 1:** Workflow: on push to `main`, run `npm ci`, `npx vitest run`, then `npm run build`, and deploy `dist/` using the official `actions/upload-pages-artifact` and `actions/deploy-pages` actions. Check their current major versions on their GitHub pages first. Build-time env comes from repository **variables** (not secrets, since these values aren't secret): `VITE_STORAGE`, `VITE_AAD_CLIENT_ID`, `VITE_AAD_TENANT_ID`, `VITE_SP_SITE_ID`, `VITE_SP_LIST_ID`.
- [ ] **Step 2 (Shubh, with Claude's steps):** create the public GitHub repo `day-planner` under SHBH-Mirai, set Pages source to "GitHub Actions", add the variables, and add the redirect URI `https://shbh-mirai.github.io/day-planner/` to the app registration.
- [ ] **Step 3:** Push, **only after Shubh says "push"**. Expected: the workflow goes green; the site loads; sign-in returns to the Pages URL; a nudge fires there.
- [ ] **Step 4:** Commit: `ci: deploy to GitHub Pages`.

### Task 14: v1 review

**Files:**
- Modify: `README.md`, `BACKLOG.md`

- [ ] **Step 1:** Check "done" from spec section 1: time yourself planning tomorrow (under 5 minutes), start and end nudges fire with the tab open, `npx vitest run` is all green, and the README states the limits.
- [ ] **Step 2:** Add a "What I learned" section to the README (TS, React, Git, MSAL/Graph, each in plain English), and a "v2 candidates" section to `BACKLOG.md` (closed-tab nudges, dark mode, SQL via Supabase or Dataverse).
- [ ] **Step 3:** Commit: `docs: v1 review and v2 backlog`.
