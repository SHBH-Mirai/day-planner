# Setup Screen (Settings + Routines) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Manage nudge settings, the default task length, and routines (templates) in the app, through a Setup screen opened from a header gear.

**Architecture:** A shared Graph request helper is pulled out of `SharePointTaskRepository`. Two small repositories (Settings, Routines) get in-memory twins and contract tests. Routine rules are pure functions in `src/domain/routine.ts`. `SetupView` shows two sections, and `TodayView` swaps it in when the gear is pressed, the way it does for Summary.

**Tech Stack:** React 19, TypeScript, Vitest + RTL, motion (`m` + LazyMotion), Microsoft Graph list items.

**Spec:** `docs/superpowers/specs/2026-10-18-setup-screen-design.md`

## Global Constraints
- Claude writes the code test-first ("just write it", Shubh 2026-10-18). Any change to an existing test needs Shubh's OK first.
- List IDs:
  - Settings `fc63f483-9505-4589-a627-11c6d2930fef`
  - Templates `13b87cf1-fe6c-4753-8a0a-b51245cb2f64`
- New env vars: `VITE_SP_SETTINGS_LIST_ID`, `VITE_SP_TEMPLATES_LIST_ID`.
- SharePoint column names:
  - Settings: `StartNudges`, `EndNudges`, `DefaultLengthMin`. Write only these 3 fields.
  - Templates: `Title`, `Category`, `StartTime`, `DurationMin`, `Days`, `Active`.
- Allowed values:
  - Weekdays: `Mon` `Tue` `Wed` `Thu` `Fri` `Sat` `Sun`.
  - Categories: `office`, `freelance`, `youtube` (shown as Office / Freelance / Content).
- Settings defaults: `{ startNudges: true, endNudges: true, defaultLengthMin: 30 }`. Lengths offered: 15, 30, 45, 60, 90.
- Routine validation: title required; `HH:mm` 00:00–23:59; length 5–720; at least 1 day.
- UI rules:
  - Elements use `m.*`, never `motion.*` (LazyMotion strict).
  - The theme tokens are `--neu-*`.
  - Switches are `role="switch"` with `aria-checked`.
- Git: branch `feat/setup-screen`. Push, PR and merge only with Shubh's OK.

## Review Focus
1. **Settings row missing or duplicated.** No row: `get` returns the defaults, and the first `save` creates exactly one row. Two rows: the first one is used. Tests in Task 3.
2. **"Add to today" when today already has that task**, created by the Morning flow or a second tap: no duplicate, and a note saying "Already on today". Test in Task 8.
3. **A routine whose time + length runs past midnight** (e.g. 23:30 + 60): the task ends the next day and saves fine. Test in Task 2.
4. **A failed save in Setup** (offline): an error with Retry shows in Setup, and the switch goes back to its saved state. Test in Task 7.
5. **The task form after the default length changes**: a new task defaults to the new length, while editing an existing task keeps that task's own times. Test in Task 6.

---

### Task 1: Check the Graph formats; extract `graphRequest`
**Files:**
- Create `src/storage/graphRequest.ts`.
- Modify `src/storage/SharePointTaskRepository.ts`.
- Create `src/test-utils/fakeListGraph.ts`.

**Interfaces:**
- `graphRequest(opts: { getToken; fetchFn; timeoutMs }, url, init?): Promise<Response>`. It has the same behaviour as today's private `request`: Bearer token, `Prefer` header, `AbortSignal.timeout`, and error → `RepositoryError` kinds.
- `fakeListGraph()`: a FetchFn that stores items per list ID. It supports GET (with `$expand=fields`, `$top`), POST, PATCH `/fields`, and DELETE. It records the requests it receives, so tests can assert on PATCH bodies.

**Steps:**
- [ ] DOCS: fetch the Microsoft Graph docs for "Create listItem" / "Update listItem" and how SharePoint columns are represented. Record the exact multi-choice and boolean formats in the ledger. If they differ from the spec's guess, rule and continue.
- [ ] Move `request` into `graphRequest`. Run the full suite: all existing tests should still pass, with none changed. Commit.

### Task 2: Routine rules
**Files:** `src/domain/routine.ts`, `src/domain/routine.test.ts`.

**Interfaces:**
- `type Weekday`, `WEEKDAYS`.
- `interface Routine`, `type RoutineDraft = Omit<Routine,'id'>`.
- `validateRoutine(d): string[]`.
- `routineToDraft(r, day: Date): TaskDraft`.
- `isOnDay(r, day, tasks: Task[]): boolean`.

**Steps:**
- [ ] Failing tests:
  - empty title → "Add a title";
  - `"9:5"` → time error;
  - length 4 and 721 → errors;
  - no days → "Pick at least one day";
  - a valid routine → `[]`;
  - `routineToDraft` at 07:15 + 45 on 18 Oct → IST start and end at 07:15 and 08:00, category kept;
  - 23:30 + 60 → end on 19 Oct (Review Focus 3);
  - `isOnDay`: a task with the same title and start → true; a different start → false.
- [ ] Implement until they pass. Commit.

### Task 3: Settings repository
**Files:**
- `src/storage/SettingsRepository.ts` (interface + defaults)
- `InMemorySettingsRepository.ts`
- `SharePointSettingsRepository.ts`
- `settingsContract.ts`
- `*.test.ts`

**Interfaces:** `Settings`, `DEFAULT_SETTINGS`, `SettingsRepository { get(); save(s) }`.

**Steps:**
- [ ] Contract tests, run against both versions:
  - with no row, `get` returns the defaults;
  - `save` then `get` round-trips the values;
  - a second `save` updates the row and doesn't add another.
- [ ] SharePoint-only tests:
  - the PATCH body has exactly `{StartNudges, EndNudges, DefaultLengthMin}`;
  - when rows exist, the first row is used;
  - with no row, `save` POSTs once.
- [ ] Implement until they pass. Commit.

### Task 4: Routine repository
**Files:**
- `src/storage/RoutineRepository.ts`
- `InMemoryRoutineRepository.ts`
- `SharePointRoutineRepository.ts`
- `routineContract.ts`
- `routineMapping.ts`
- tests for each

**Interfaces:**
- `RoutineRepository { list(): Promise<Routine[]> sorted by startTime; create(d); update(r); remove(id) }`
- `toRoutineFields(d)`, `fromRoutineItem(item)`

**Steps:**
- [ ] Contract tests:
  - create then list;
  - list is sorted by start time;
  - update changes it;
  - remove deletes it;
  - removing a missing ID throws `notFound`.
- [ ] Mapping tests:
  - `Days` is written in the Task 1 format and read back as `Weekday[]`;
  - `Active` is a boolean;
  - `DurationMin` is a number;
  - a missing `Category` reads as `office`.
- [ ] Implement until they pass. Commit.

### Task 5: Config and wiring
**Files:**
- `src/vite-env.d.ts`
- `src/auth/msal.ts` (the `AppEnv` pick)
- `src/App.tsx`
- `src/App.test.tsx` (new test only)
- `.github/workflows/deploy.yml`

**Steps:**
- [ ] Failing test: memory mode passes in-memory Settings and Routines repositories. Pressing the gear in App shows "Setup" (this goes red until Task 9; keep it as the end-to-end check).
- [ ] Add the 2 env vars to the types, `AppEnv` and `deploy.yml`. `SharePointApp` builds both SharePoint repositories with the same `getToken`. `TodayView` gets new props: `settingsRepo` and `routineRepo`.
- [ ] Commit.

### Task 6: Task form uses the default length
**Files:** `src/ui/TaskForm.tsx` and `TaskForm.test.tsx` (new tests only).

**Interfaces:** `TaskForm` prop `defaultLengthMin?: number`, default 30.

**Steps:**
- [ ] Failing tests:
  - with `defaultLengthMin={45}`, a new form's end is start + 45;
  - when editing (an `initial` task), it keeps that task's own end (Review Focus 5).
- [ ] Implement by replacing `DEFAULT_LENGTH_MS` with the prop. Run the existing TaskForm tests unchanged. Commit.

### Task 7: Setup — Nudges & defaults
**Files:**
- `src/ui/SetupView.tsx`, `src/ui/SetupView.test.tsx`
- `src/ui/neu/Switch.tsx`, `src/ui/neu/Switch.test.tsx`
- `theme.css`

**Interfaces:**
- `Switch({ checked, onChange, label })`
- `SetupView({ settingsRepo, routineRepo, todayTasks, addToToday, onBack })`

**Steps:**
- [ ] Failing tests:
  - Switch: `role="switch"` with `aria-checked`, toggles on click and on Space;
  - Setup: the switches show the stored values;
  - toggling "Start cards in Teams" saves `startNudges: false` and shows "Saved";
  - choosing 45 saves `defaultLengthMin: 45`;
  - a failed save shows an alert with Retry and the switch goes back (Review Focus 4);
  - Back calls `onBack`.
- [ ] Implement until they pass. Commit.

### Task 8: Setup — Routines
**Files:**
- `src/ui/RoutineList.tsx`, `src/ui/RoutineForm.tsx`
- their tests
- `SetupView.tsx`
- `theme.css`

**Steps:**
- [ ] Failing tests:
  - routines are listed with `HH:mm · 45m` and the active day chips;
  - **+ New routine** → sheet → save → it appears;
  - an invalid form shows the validation messages and nothing is saved;
  - Edit opens the form filled in;
  - the Active switch saves;
  - Delete confirms with the recycle-bin text, then removes it, and Cancel keeps it;
  - Add to today calls `addToToday` with `routineToDraft`;
  - when `isOnDay` is true it shows "Already on today" and doesn't call it (Review Focus 2).
- [ ] Implement until they pass. Commit.

### Task 9: Gear in TodayView
**Files:** `src/ui/TodayView.tsx` and `TodayView.neu.test.tsx` (new tests only).

**Steps:**
- [ ] Failing tests:
  - the gear button (`aria-label="Setup"`) shows SetupView and hides the timeline and the + button;
  - Back returns to the previous tab;
  - Add to today from Setup puts the task on Today's list;
  - after changing the default length to 60 in Setup, the + form's default end is start + 60.
- [ ] Implement: a `view` state (`day | summary | setup`). Settings load once per mount, and the form gets `defaultLengthMin`.
- [ ] Run the full suite, lint and build. The Task 5 App test passes. Commit.

### Task 10: Ship
- [ ] `.env.local`: add the 2 list IDs (Claude). GitHub repo variables: `gh variable set` for both (Claude; config work).
- [ ] A final whole-branch review by a fresh reviewer (most capable model), followed by one fix pass.
- [ ] Ask Shubh, then push, PR, merge, and watch the deploy.
- [ ] Live check in Teams, against real data, with Shubh's OK:
  - Setup loads his real Settings row;
  - create a routine "TEST routine", press Add to today, then delete both (they go to the recycle bin);
  - flip a switch and flip it back.
