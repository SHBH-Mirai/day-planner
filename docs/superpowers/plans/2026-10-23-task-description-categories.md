# Task descriptions and nine categories — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every task and routine gets an optional description shown wherever a nudge shows. The category list grows to nine, and the third category becomes Projects.

**Architecture:** Phase 1 (PR 1, branch `feat/task-description`) adds `description` from the domain types through the SharePoint mapping, the forms, the row, the table and the nudges, then the three flows that create or show tasks. Phase 2 (PR 2, branch `feat/categories`, cut from `main` after PR 1 merges) widens `Category` to nine keys, builds per-category totals from `CATEGORIES`, and moves each flow onto one `Category_map`. The SharePoint data then moves in the spec's five rollout steps.

**Tech Stack:** React 19, TypeScript ~6.0, Vite 8.3, Vitest 5 + React Testing Library (tests pinned to IST), oxlint, motion 13.5.1 (`motion/react`, LazyMotion strict), Microsoft Graph, Power Automate (Dataverse `clientdata` exports in `flows/*.json`), SharePoint lists.

**Spec:** `docs/superpowers/specs/2026-10-23-task-description-categories-design.md`

## Global Constraints

- Commands: `npm test` (vitest run), `npm run lint` (oxlint), `npx tsc -b`, `npm run build`. All four pass before every commit that touches `src/`.
- Description: plain text, at most **500** characters after trimming; whitespace-only = none; none is saved as `null`.
- Copy, exact: label `Description (optional)`; error `Keep the description under 500 characters`; counter `N/500`, shown from 400 characters.
- Category keys, in order: `office`, `projects`, `youtube`, `recording`, `editing`, `learning`, `health`, `personal`, `breaks`. Labels: Office, Projects, Content, Recording, Editing, Learning, Health, Personal, Breaks & meals. Icons: 💼 ✍️ 🎬 🎙️ ✂️ 📚 💪 🏠 🍽️. Teams card colours: Accent, Good, Attention, Attention, Attention, Accent, Good, Default, Default.
- Motion components are `m.*`, never `motion.*`. No `window.alert`, `window.confirm` or `window.prompt` (blocked in Teams desktop).
- Public repo: after Phase 2, `git grep -i -E 'free[l]ance|cli[e]nt work'` matches only the temporary read rule and its test (until rollout step 5). README, commit and PR text follow the owner's public wording rules.
- Existing tests: Phase 1 changes none. Phase 2 changes only the lines in the spec's "Existing tests that change" table. Anything else stops and goes to Shubh.
- Never push, merge or open a PR without Shubh's word. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Live work: Shubh's usual Chrome profile (named in his private notes). Only TEST-named tasks and routines. Recycling TEST rows needs Shubh's OK (asked once per phase). Deleting a column needs his "I confirm".
- Flow deploys follow the #18/#19 method:
  1. Check the live definition matches the repo file (SHA-256).
  2. Make a backup copy "(backup before <change>)", turned Off.
  3. PATCH `clientdata` with If-Match.
  4. Read it back and compare hashes.
  5. Run the live checks.

## Review Focus

1. **Clearing a description.** Emptying the field in the edit sheet or routine form must clear the saved text. `TodayView` saves `{ ...current, ...draft }`, so a draft *without* a `description` key would keep the old text. → Tests in Task 4.
2. **Line breaks, emoji and exactly 500 characters** round-trip through SharePoint and show with their line breaks. → Tests in Tasks 2, 3 and 5.
3. **A task with no description** renders no empty element in the row, table or banner, and no blank block on Teams cards. → Tests in Task 5; live check in Task 7.
4. **Quotes, backslashes, `@`, `{}` and newlines** in a description must not break a Teams card or the Add task form. → Live check cases in Task 7.
5. **An old or unknown category value** (a hand edit, or mid-migration) reads as `projects` / `office`. It never shows as `undefined` or makes totals `NaN`. → Tests in Task 8.

---

# Phase 1 — Descriptions (PR 1, branch `feat/task-description`)

### Task 1: SharePoint columns and the Graph format check (config, no code test)

**Files:**
- Modify: `docs/setup-microsoft.md` (columns table in step 1.3: add the `TaskDescription` row, plus a note that Templates has `Description`)

- [ ] **Step 1:** In SharePoint (Development site), add a **Multiple lines of text → Plain text** column named exactly `TaskDescription` to DayPlannerTasks, and `Description` to Templates. Shubh clicks, or Claude does it in Shubh's signed-in Chrome profile.
- [ ] **Step 2:** Create a TEST task in the list UI with the description `line 1⏎line 2 "quoted" ✂️`. Read it with Graph (`GET /sites/{site-id}/lists/{list-id}/items/{id}?$expand=fields`).
  Expected: `"TaskDescription": "line 1\nline 2 \"quoted\" ✂️"` as a plain string. If it comes back as HTML or an object, stop: the mapping in Task 3 changes.
- [ ] **Step 3:** Update `docs/setup-microsoft.md`, then commit `docs: TaskDescription column in the setup guide`.

### Task 2: Domain — description on tasks and routines

**Files:**
- Modify: `src/domain/task.ts`, `src/domain/routine.ts`, `src/domain/validate.ts`
- Test: `src/domain/validate.test.ts` and `src/domain/routine.test.ts` (new tests appended)

**Interfaces — Produces:**
- `Task.description?: string`; `TaskDraft = Pick<Task, 'title' | 'start' | 'end' | 'category'> & { description?: string }`
- `Routine.description?: string` (so `RoutineDraft` has it)
- `export const MAX_DESCRIPTION = 500` and `export function normaliseDescription(text: string | undefined): string | undefined` in `task.ts` (trims; empty → `undefined`)
- `validateTask` and `validateRoutine` add the error `Keep the description under 500 characters`
- `routineToDraft` copies `description`

- [ ] **Step 1: Write the failing tests**
  - `normaliseDescription`: `'  a  '` → `'a'`; `'   '` → `undefined`; `undefined` → `undefined`; `'a\nb'` is kept as is.
  - `validateTask`: `{ ...draft, description: 'x'.repeat(501) }` → errors contain `Keep the description under 500 characters`; `'x'.repeat(500)` → no such error; `' '.repeat(600)` → no such error.
  - `validateRoutine`: the same three cases.
  - `routineToDraft({ ...routine, description: 'Scene, record, dub' }, day).description` → `'Scene, record, dub'`; with no description → `undefined`.
- [ ] **Step 2:** Run `npx vitest run src/domain`. Expected: FAIL (`normaliseDescription` is not exported, and the errors are missing).
- [ ] **Step 3:** Implement the interfaces above. The length is checked on `normaliseDescription(...)`.
- [ ] **Step 4:** Run `npx vitest run src/domain`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(domain): optional description on tasks and routines`.

### Task 3: Storage — mapping and contracts

**Files:**
- Modify: `src/storage/sharePointMapping.ts`, `src/storage/routineMapping.ts`
- Modify (new contract tests appended): `src/storage/repositoryContract.ts`, `src/storage/routineContract.ts`
- Test: `src/storage/sharePointMapping.test.ts`, `src/storage/routineRepository.test.ts` (new tests appended)

**Interfaces:**
- Consumes: `Task.description`, `Routine.description` (Task 2)
- Produces:
  - `TaskFields.TaskDescription?: string | null`. `toFields` sends `task.description ?? null`. `fromItem` sets `description` only for a non-blank string.
  - `toRoutineFields` sends `Description: r.description ?? null`. `fromRoutineItem` reads `Description` the same way.

- [ ] **Step 1: Write the failing tests**
  - `toFields(makeTask({ description: 'a\nb' })).TaskDescription` → `'a\nb'`; `toFields(makeTask()).TaskDescription` → `null`.
  - `fromItem` with `TaskDescription: 'a\nb'` → `description: 'a\nb'`; with `null`, `''` or missing → no `description` key (`expect(task).not.toHaveProperty('description')`).
  - Routine mapping: the same pairs with `Description`.
  - Contract `create and update keep the description; clearing removes it`:
    1. Create with `description: 'Steps ✂️'` → the listed task has it.
    2. Update with `description: 'New'` → the listed task has `'New'`.
    3. Update with `description: undefined` → the listed task has no description.
  - The same contract test for routines.
- [ ] **Step 2:** Run `npx vitest run src/storage`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement the interfaces above. The in-memory repos already spread the draft; only fix what the contract shows.
- [ ] **Step 4:** Run `npx vitest run src/storage`. Expected: PASS for both in-memory and SharePoint (`fakeListGraph`) implementations.
- [ ] **Step 5:** Commit `feat(storage): save and read task and routine descriptions`.

### Task 4: Forms — type it, and clearing works

**Files:**
- Modify: `src/ui/TaskForm.tsx`, `src/ui/RoutineForm.tsx`
- Test: `src/ui/TaskForm.test.tsx` (appended), new `src/ui/RoutineForm.test.tsx`, `src/ui/TodayView.test.tsx` and `src/ui/SetupView.test.tsx` (appended)

**Interfaces:**
- Consumes: `normaliseDescription`, `MAX_DESCRIPTION`, the validation errors (Task 2)
- Produces: both forms put `description: normaliseDescription(text)` in **every** draft they submit. The key is always present, even when `undefined`.

- [ ] **Step 1: Write the failing tests**
  - TaskForm: a textbox labelled `Description (optional)` shows `initial.description`. Typing `'  Steps  '` and saving → `onSubmit` gets `description: 'Steps'`.
  - TaskForm: 501 characters → the alert shows `Keep the description under 500 characters` and `onSubmit` isn't called. At 400 characters the text `400/500` is shown; at 399 it isn't.
  - TaskForm: editing a task that has a description, clearing it and saving → `onSubmit` gets an object where `'description' in draft` is true and its value is `undefined`.
  - RoutineForm: the same label, the initial value, trimming, and the over-500 error.
  - TodayView (in-memory repo): edit a task with description `'Old'`, clear the field, save → the repo's task has no description (Review Focus 1).
  - SetupView: the same check for a routine.
- [ ] **Step 2:** Run `npx vitest run src/ui/TaskForm.test.tsx src/ui/RoutineForm.test.tsx src/ui/TodayView.test.tsx src/ui/SetupView.test.tsx`. Expected: the new tests FAIL.
- [ ] **Step 3:** Add a `<textarea rows={3}>` under Title in both forms, bound to a state string, with the counter `${n}/500` when `n >= 400`. Use the existing `task-form` styles.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit `feat(ui): description field in the task and routine forms`.

### Task 5: Show it — row, table, banner, pop-up

**Files:**
- Modify: `src/ui/neu/TaskRow.tsx`, `src/ui/TaskTable.tsx`, `src/ui/NudgeBanner.tsx`, `src/notify/notify.ts`, `src/ui/theme.css`
- Test: `src/ui/neu/TaskRow.test.tsx`, `src/ui/TaskTable.test.tsx`, `src/ui/NudgeBanner.test.tsx`, `src/notify/notify.test.ts`, `src/domain/push.test.ts` (all appended)

**Interfaces:**
- Consumes: `Task.description`
- Produces:
  - `export function firstLine(text: string | undefined): string | undefined` in `notify.ts`
  - `showOsNotification` passes `body: firstLine(n.task.description)` only when there is one
  - CSS classes `.task-row-description` (`white-space: pre-line`), `.table-description` (one line, ellipsis), `.nudge-description`

- [ ] **Step 1: Write the failing tests**
  - TaskRow: with `description: 'Scene\nRecord'`, the text isn't in the document while folded, and is visible after clicking the row toggle. Without a description, unfolding adds no `.task-row-description` element.
  - TaskTable: the row shows `Scene` in `.table-description`. Without a description there's no `.table-description` element.
  - NudgeBanner: a start nudge for a task with a description shows it. Without one, there's no `.nudge-description`.
  - `firstLine('a\nb')` → `'a'`; `firstLine(undefined)` → `undefined`. `showOsNotification` (with `Notification` stubbed) is called with `{ tag, body: 'a' }`, and with no `body` key when there is no description.
  - `pushTask` and `pushChain`: every returned task keeps its `description`.
- [ ] **Step 2:** Run `npx vitest run src/ui/neu/TaskRow.test.tsx src/ui/TaskTable.test.tsx src/ui/NudgeBanner.test.tsx src/notify src/domain/push.test.ts`. Expected: the new tests FAIL (the push test may already pass; keep it as a guard).
- [ ] **Step 3:** Implement:
  - TaskRow: render `<p className="task-row-description">` as the first child of the open `m.div`.
  - TaskTable: a `<span className="table-description">` after `.table-meta`.
  - NudgeBanner: a `<p className="nudge-description">` after the `<strong>`.
  - The pop-up body.
  - The 3 CSS rules.
- [ ] **Step 4:** Run the same command, then the full `npm test`, `npm run lint`, `npx tsc -b` and `npm run build`. Expected: all pass.
- [ ] **Step 5:** Commit `feat(ui): show descriptions in the row, table, banner and pop-up`.

### Task 6: Flows — show, copy and collect the description (no code test)

**Files:**
- Modify: `flows/nudges.json` (`Start_card`, `Stop_card`), `flows/morning.json` (`Create_task`), `flows/add-task.json` (`Init_description`, `Form_card`, `Keep_description`, `Create_task`, `Next_description`), `README.md` (flows table and features)

- [ ] **Step 1:** Find the environment's Dataverse URL and the three flows' workflow ids (make.powerautomate.com → Solutions → Day Planner). For each flow, export the live `clientdata` and compare its SHA-256 with the repo file. Expected: equal. If not, stop and tell Shubh: someone changed it live.
- [ ] **Step 2: nudges.** In `Start_card` and `Stop_card`, add a TextBlock right after the title TextBlock:
  ```json
  { "type": "TextBlock", "text": "@{coalesce(body('Get_item_start')?['TaskDescription'], '')}", "wrap": true, "maxLines": 4, "isSubtle": true, "spacing": "Small", "isVisible": "@not(empty(body('Get_item_start')?['TaskDescription']))" }
  ```
  In `Stop_card`, use `Get_item_end` instead. The whole-expression `"@not(...)"` evaluates to a boolean, not a string.
- [ ] **Step 3: morning.** `Create_task` sets `item/TaskDescription` to `items('Each_template')?['Description']`.
- [ ] **Step 4: add-task.**
  - `Init_description` (string, `''`).
  - `Form_card`: an `Input.Text` with id `description`, `isMultiline: true`, `maxLength: 500`, label `Description (optional)`, value `@{variables('description')}`.
  - `Keep_description` sets the variable from the card response.
  - `Create_task` writes `item/TaskDescription` = `@{trim(variables('description'))}` (an empty string leaves the column empty).
  - `Next_description` resets it to `''`.
- [ ] **Step 5:** Deploy each flow by the Global Constraints method (backups named "(backup before descriptions)").
- [ ] **Step 6:** Update README, then commit `feat(flows): descriptions on Teams cards, Morning tasks and the Add task form`.

### Task 7: Live check and PR 1

- [ ] **Step 1:** Run the app locally (`VITE_STORAGE=memory npx vite`) and against SharePoint. Check the sheet, row, table and banner by eye.
- [ ] **Step 2:** Run design-critic on the description UI (row, table, banner, form); fix what it confirms.
- [ ] **Step 3: Live Teams checks**, with TEST tasks starting 2–3 minutes ahead:

  | Case | Expected |
  |---|---|
  | D1: task with `Steps "quoted" \ @ {x}` + newline | Starting-now card shows the text wrapped and unbroken |
  | D2: task with no description | Card has no blank block |
  | D3: description edited while the run waits | One card, showing the new text |
  | D4: Add task form with a description | Saved to `TaskDescription` |
  | D5: Quick add with a description | Saved too |
  | D6: TEST routine with a description, Morning flow run manually (or "Add to today") | Task carries the description |

- [ ] **Step 4:** Run phase-reviewer on the whole branch; fix what it confirms.
- [ ] **Step 5:** Ask Shubh to push and open PR 1 (`gh pr create`, body with the live-test table, ending `🤖 Generated with [Claude Code](https://claude.com/claude-code)`). After his merge, watch the deploy run and open the live site.
- [ ] **Step 6:** Write the QA doc `dev-hub/projects/day-planner/qa/task-descriptions.md`, add a version-log row, update `## State`. Ask before recycling the TEST rows.

---

# Phase 2 — Nine categories and Projects (PR 2, branch `feat/categories` from `main` after PR 1)

### Task 8: One category list, with the rename

**Files:**
- Modify: `src/domain/task.ts`, `src/ui/labels.ts`, `src/ui/neu/TaskRow.tsx` (icon map moves out), `src/domain/summary.ts`, `src/ui/neu/totals.ts`, `src/storage/sharePointMapping.ts`, `src/storage/routineMapping.ts`
- Test: new tests in `src/domain/task.test.ts` (new file) and `src/ui/labels.test.ts` (new file), plus the spec's approved edits to the 6 existing test files

**Interfaces — Produces:**
- `Category` = the nine keys in Global Constraints order; `CATEGORIES` in that order
- `CATEGORY_LABEL` and `CATEGORY_ICON` (both `Record<Category, string>`) in `labels.ts`
- `export function emptyPerCategory(): Record<Category, number>` (all nine at 0) in `task.ts`, used by `summarize` and `dayTotals`
- `export function readCategory(raw: unknown): Category` in `task.ts`: a known key → itself; the old third key → `'projects'` (temporary, removed in Task 14); anything else → `'office'`. Used by `fromItem` and `fromRoutineItem`.

- [ ] **Step 1: Write the failing tests**
  - `CATEGORIES` equals the nine keys in order.
  - Every category has a non-empty label and icon. `CATEGORY_LABEL.youtube` → `'Content'`; `CATEGORY_LABEL.breaks` → `'Breaks & meals'`.
  - `emptyPerCategory()` has nine keys, all 0.
  - `readCategory`: `'health'` → `'health'`; the old key → `'projects'`; `'nope'`, `undefined` and `42` → `'office'`.
  - `fromItem` with `TaskCategory: 'nope'` → `category: 'office'`. `dayTotals([makeTask({ category: readCategory('nope') })])` has no `NaN` (Review Focus 5).
- [ ] **Step 2:** Apply the spec's approved edits to the 6 existing test files: old key → `projects`, fixture title → `Portfolio site`, `/Projects/`, full `perCategory` objects gain the six new keys at 0. Change nothing else.
- [ ] **Step 3:** Run `npm test`. Expected: the new tests and the edited tests FAIL (the type still lacks `projects`).
- [ ] **Step 4:** Implement the interfaces above.
- [ ] **Step 5:** Run `npm test`, `npx tsc -b` and `npm run lint`. Expected: PASS.
- [ ] **Step 6:** Commit `feat(domain): nine categories, one list, Projects`.

### Task 9: Breaks & meals count as a break

**Files:** Modify `src/domain/validate.ts`. Test: `src/domain/validate.test.ts` (appended)

- [ ] **Step 1: Write the failing test.** `findNoBreakRuns` with office 09:00–11:00, breaks 11:00–11:30, office 11:30–13:30 (IST) → `[]`. The same tasks with the middle one as `personal` → one run, 09:00–13:30.
- [ ] **Step 2:** Run `npx vitest run src/domain/validate.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Filter out `category === 'breaks'` alongside `status === 'skipped'` in `findNoBreakRuns`.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit `feat(domain): Breaks & meals count as a break`.

### Task 10: Colours and pickers

**Files:** Modify `src/ui/theme.css`. Test: `src/ui/SummaryView.test.tsx`, `src/ui/TaskForm.test.tsx`, `src/ui/RoutineForm.test.tsx` (appended)

- [ ] **Step 1: Write the failing tests.**
  - TaskForm and RoutineForm list nine options, in order, with the labels.
  - SummaryView with one `recording` (30 min) and one `breaks` (60 min) task shows both in the bar (`aria-label` `Recording 30 min`) and in the legend.
- [ ] **Step 2:** Run those files. Expected: the SummaryView test FAILs if the bar has no style for the new keys. The option tests may already pass; keep them as guards.
- [ ] **Step 3:** In `theme.css`, add `--cat-<key>` for the six new keys and `projects` (replacing the old third variable) in the light, dark and contrast blocks, plus the `[data-category]` rules for `.task-row`, `.category-segment`, `.category-legend` and `.table-row .table-meta`.
  - Use the colour families from the spec, one shade per key.
  - Each light and dark value must reach a contrast of 4.5:1 or more against `--surface`. Check every value with a contrast calculator and list the ratios in the commit body.
  - In the contrast theme: white, with patterns on alternate segments.
- [ ] **Step 4:** Run `npm test` and `npm run build`. Then design-critic on the summary bar and row colours, light and dark (local `VITE_STORAGE=memory`).
- [ ] **Step 5:** Commit `feat(ui): colours for nine categories`.

### Task 11: Docs, manifest, scrub

**Files:** Modify `README.md`, `docs/setup-microsoft.md`, every file in `docs/superpowers/specs/` and `docs/superpowers/plans/` that matches, and `teams-app/manifest.json` (`version` `1.2.0`; `description.full` "Plan today and tomorrow across office, project and content work. Tasks are saved in your SharePoint list, and Teams cards nudge you at each task's start and end.")

- [ ] **Step 1:** Replace the old word with Projects / `projects` in prose and in the column tables.
- [ ] **Step 2:** Run `git grep -n -i -E 'free[l]ance|cli[e]nt work'`. Expected: only `readCategory`'s legacy line and its test.
- [ ] **Step 3:** Commit `docs: Projects and the nine categories in docs and manifest`.

### Task 12: SharePoint, add only (rollout step 1; config)

- [ ] **Step 1:** Add choices `projects`, `recording`, `editing`, `learning`, `health`, `personal`, `breaks` to `TaskCategory` (DayPlannerTasks) and `Category` (Templates). Keep the old choice.
- [ ] **Step 2:** Add Number columns `ProjectsMin`, `RecordingMin`, `EditingMin`, `LearningMin`, `HealthMin`, `PersonalMin` and `BreaksMin` to DailySummaries.
- [ ] **Step 3:** Check: a TEST task saved as `recording` from the app (local, SharePoint storage) reads back as `recording`.

### Task 13: Flows — one map, nine categories (no code test)

**Files:** Modify `flows/nudges.json`, `flows/morning.json`, `flows/add-task.json`, `flows/evening.json`

- [ ] **Step 1:** Re-check each live definition hash against `main` (Phase 1 deploys changed them).
- [ ] **Step 2:** Add a top-level `Category_map` Compose to nudges, morning and add-task, holding `{ "<key>": { "icon", "label", "color" } }` for all nine (Global Constraints values). Replace every nested category `if()` with a lookup: `coalesce(outputs('Category_map')?[<key expr>]?['icon'], '💼')`, and the same for label and colour.
- [ ] **Step 3:** In add-task, the category ChoiceSet lists all nine (title = label, value = key).
- [ ] **Step 4:** In evening:
  - Replace `Init_<old>` and `Add_<old>` with nine `Init_<key>`.
  - Add a `Switch` inside `Each_task` on `items('Each_task')?['TaskCategory']?['Value']`, with one case per key, each incrementing its variable by the same minutes expression the current `Add_office` uses.
  - Write `OfficeMin`, `ProjectsMin`, `YoutubeMin` and the six new columns in `Update_row` and `Create_row`.
  - The Shutdown card lists only categories with more than 0 minutes.
- [ ] **Step 5:** Commit `feat(flows): one category map per flow, nine categories`. Deploy after PR 2 merges (Task 14).

### Task 14: PR 2, rollout steps 2–5

Run steps 2–4 in one sitting, away from 06:00 (Morning) and 22:30 IST (Evening).

- [ ] **Step 1:** Run phase-reviewer on the whole branch; fix what it confirms. Then ask Shubh to push and open PR 2. After his merge, watch the deploy and open the live site (rollout step 2).
- [ ] **Step 2:** Deploy the four flows by the Global Constraints method, with backups named "(backup before nine categories)" (step 3).
- [ ] **Step 3:** Move the data (step 4). Count, then change every DayPlannerTasks and Templates row that has the old key to `projects` (list view filter + bulk edit). Copy the old third `*Min` column into `ProjectsMin` for every DailySummaries row (grid view). Re-count: 0 rows left with the old key.
- [ ] **Step 4: Live checks.**
  - N1: a Starting-now card for a TEST `recording` task shows 🎙️ Recording.
  - N2: the Add task form offers nine categories.
  - N3: Evening, run manually on a day with a `breaks` task, writes `BreaksMin` and lists Breaks & meals.
  - N4: Morning with a TEST `learning` routine.
- [ ] **Step 5: Clean up (step 5).**
  - Remove the old choice from both columns.
  - Remove the legacy line in `readCategory` **and its test**. Ask Shubh first, because that deletes an existing test.
  - Delete the old `*Min` column only after Shubh's **"I confirm"**.
- [ ] **Step 6:** Shubh re-uploads the Teams app (manifest 1.2.0) in the admin center.
- [ ] **Step 7:** Write the QA doc `dev-hub/projects/day-planner/qa/nine-categories.md`, add version-log rows, and update `## State`. Ask before recycling TEST rows.
