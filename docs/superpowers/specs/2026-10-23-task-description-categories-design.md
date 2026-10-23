# Day Planner: Task descriptions and nine categories — design spec

Date: 2026-10-23 · Owner: Shubh · Status: design approved in chat (approach B); spec awaiting review

## Goal

When a nudge fires, a short title ("focus 1", "inference") should still say what to do. Every task and routine gets an optional description, shown wherever a nudge shows. The category list also grows from three to nine, and the third category gets the neutral name **Projects**.

## Decisions (Shubh, 2026-10-23, in chat)

- **Why descriptions:** short titles get vague by the time the Teams card fires (5-whys, level 2).
- **Description everywhere:** the app's add/edit sheet, routines, the Teams Add task form (and so Quick add), Starting-now and Time's-up cards, and the in-app nudge banner.
- **Categories:** Office, Projects, Content stay. Recording, Editing, Learning, Health, Personal and Breaks & meals are added. Recording and Editing are categories of their own, next to Content.
- **Rename:** the third category becomes **Projects** (stored `projects`) everywhere: code, SharePoint values, flows, docs, Teams manifest, and the old specs and plans.
- **Flows (approach B):** one category list in the code, one lookup map per flow. Categories are not editable in Setup.
- **Breaks & meals count as a break** in the "3h without a break" warning.
- **Two PRs:** PR 1 descriptions, then PR 2 categories and the rename.
- **Who writes the code:** Claude, test-first ("just write it" for this feature, Shubh 2026-10-23). Shubh approves the spec, the plan and the PRs.
- **Existing tests:** Shubh approved the PR 2 test edits listed below (renames and new zero totals only). Any other change to an existing test goes back to him first.

## Facts this rests on

- CODE (`src/domain/task.ts:1,22`): `Category` is a fixed union of three keys and `CATEGORIES` lists them. `TaskDraft` picks title, start, end and category.
- CODE (`src/storage/sharePointMapping.ts`): `toFields` writes every column on each save, and `fromItem` reads `TaskCategory` with no fallback. The SharePoint repo PATCHes `toFields(task)` (`src/storage/SharePointTaskRepository.ts:45`), so pushes and Undo resend all fields, including a new description.
- CODE (`src/storage/routineMapping.ts`): an unknown routine category already reads as `office`.
- CODE (`flows/nudges.json`): the category's icon, label and card colour are nested `if()` expressions repeated for each card. The flow triggers on any change to a planned task.
- DOCS (`docs/superpowers/specs/2026-10-17-teams-nudges-design.md:31,46`): before posting, a waiting run re-reads the item and continues only if `Modified` is unchanged. So editing only a description can't post duplicate cards, and the card shows the latest text.
- CODE (`flows/quick-add.json`): Quick add only calls the Add task flow, so adding the field to that form covers Quick add too.
- CODE (`flows/evening.json`): one `Init_*` and one `Add_*` variable per category, written to `OfficeMin`, `YoutubeMin` and the third `*Min` column of `DailySummaries`.
- CODE (`src/ui/theme.css:17-63`): each category has a colour in the light, dark and contrast themes. Table view uses that colour for text.

## Part 1: Description (PR 1)

### Data
- `Task.description?: string` and `Routine.description?: string`. `TaskDraft` and `RoutineDraft` carry it too.
- Plain text, at most **500 characters** after trimming. Whitespace-only counts as no description.
- SharePoint: a new **Multiple lines of text, plain** column `TaskDescription` in DayPlannerTasks and `Description` in Templates. An empty description is saved as `null`, which clears the column.

### App
- **Add/edit sheet** (`TaskForm`): a "Description (optional)" text area under Title, with a character count from 400 onwards. Over 500 blocks saving: "Keep the description under 500 characters".
- **Routine form** (`RoutineForm`): the same text area. `routineToDraft` copies the description, so "Add to today" brings it along.
- **List row** (`TaskRow`): unfolding a row shows the description, line breaks kept, above the actions.
- **Table view** (`TaskTable`): one muted line under the title, cut to a single line.
- **In-app nudges:** the banner shows the description under the task's title. The browser pop-up adds its first line to the body.
- Pushes, +30, Skip, Done and Undo never change the description.

### Flows
- **Teams nudges:** the Starting-now and Time's-up cards show the description under the title (wrapping, up to 4 lines, subtle text). No description, no text block.
- **Morning:** copies a routine's `Description` into the new task's `TaskDescription`.
- **Add task:** the form gets a multi-line "Description" input (max 500), saved to `TaskDescription`. Quick add gets it through the same form.

## Part 2: Nine categories and the Projects rename (PR 2)

### The nine categories

| Key | Label | Icon | Colour family | Teams card colour |
|---|---|---|---|---|
| `office` | Office | 💼 | work (blue) | Accent |
| `projects` | Projects | ✍️ | work (green) | Good |
| `youtube` | Content | 🎬 | content (orange) | Attention |
| `recording` | Recording | 🎙️ | content (orange) | Attention |
| `editing` | Editing | ✂️ | content (orange) | Attention |
| `learning` | Learning | 📚 | life (purple) | Accent |
| `health` | Health | 💪 | life (teal) | Good |
| `personal` | Personal | 🏠 | life (grey) | Default |
| `breaks` | Breaks & meals | 🍽️ | life (sand) | Default |

- `youtube` stays the stored key for Content (unchanged from today).
- The order above is the order in every picker, summary and legend.
- Colours: one shade per category inside its family. Each passes 4.5:1 against the row surface in light and dark, because Table view uses it for text. The contrast theme keeps white with patterns; the legend names every category with its minutes, so the bar never relies on colour alone.
- Teams cards have only a few named text colours, so categories share them. The icon and label tell them apart.

### Code: one list
- `Category` and `CATEGORIES` in `src/domain/task.ts` hold the nine keys. Labels and icons sit in one place in `src/ui/labels.ts`, next to the label map (the icon map moves out of `TaskRow`).
- Per-category totals (`summary.ts`, `neu/totals.ts`) are built from `CATEGORIES`, not written out by hand.
- `fromItem` and `fromRoutineItem` read an unknown category as `office`. During the switch they also read the old third key as `projects` (see Rollout). That rule is removed once the data has moved.

### Flows: one map per flow
- **Nudges, Morning, Add task:** one `Category_map` Compose holding `{ key: { icon, label, color } }` for all nine. Cards look values up by key, falling back to `office`. This replaces the nested `if()` expressions.
- **Add task:** the category choice set lists all nine.
- **Evening:** a Switch on the task's category, with 9 cases, adds minutes to the matching variable. `DailySummaries` gets `ProjectsMin`, `RecordingMin`, `EditingMin`, `LearningMin`, `HealthMin`, `PersonalMin` and `BreaksMin`; `OfficeMin` and `YoutubeMin` stay. The Shutdown card lists only categories that have minutes.

### Breaks count as a break
`findNoBreakRuns` ignores `breaks` tasks the way it ignores skipped ones. So 2h of work, a 30-min lunch, then 2h more raises no warning.

### Rollout of the rename (order matters)
1. **Add only:** add the new choices (`projects` + the six new keys) to `TaskCategory` and Templates `Category`, and the new `*Min` columns to `DailySummaries`.
2. **Merge PR 2:** the app knows all nine keys and reads the old third key as `projects`.
3. **Deploy the flows** (backups first, as in #18/#19).
4. **Move the data:** every task and routine with the old key → `projects`. Copy the old third `*Min` column into `ProjectsMin` for every summary row.
5. **Clean up:** remove the old choice from both columns, remove the read rule in a small follow-up commit, and delete the old `*Min` column. SharePoint column internal names can't be renamed, so the column is replaced, not renamed. Deleting it needs Shubh's "I confirm".

### Docs and manifest
- README, `docs/setup-microsoft.md`, and the earlier specs and plans in `docs/superpowers/` use the new name.
- `teams-app/manifest.json`: the description says "office, project and content work", and the version goes from 1.1.0 to 1.2.0. Shubh re-uploads it in the Teams admin center.
- This cleans the current files only. Git history and earlier PR text keep the old wording.

## Existing tests that change (approved by Shubh, 2026-10-23, PR 2 only)

| File | Lines | Change |
|---|---|---|
| `src/domain/summary.test.ts` | 10, 11, 30, 53, 57 | old key → `projects`, fixture title → "Portfolio site", full `perCategory` objects gain the six new keys at 0 |
| `src/domain/validate.test.ts` | 11 | old key → `projects` |
| `src/storage/routineRepository.test.ts` | 20, 23 | old key → `projects` |
| `src/storage/sharePointMapping.test.ts` | 12 | old key → `projects` |
| `src/ui/SummaryView.test.tsx` | 11, 12, 22, 30, 61 | old key → `projects`, fixture title → "Portfolio site", old label → `/Projects/` |
| `src/ui/neu/totals.test.ts` | 45, 52 | old key → `projects`, `perCategory` gains the six new keys at 0 |

PR 1 changes no existing test.

## Testing (new tests, written first)

**PR 1**
- `validateTask` / `validateRoutine`: a 501-character description is an error, 500 is fine, and whitespace-only is treated as none.
- `toFields` / `fromItem`: description is sent as text, or `null` when empty; read back when set and left out when empty.
- Repository contracts (in-memory and SharePoint twins): a description round-trips on create and update, and clearing it removes it.
- `routineToDraft` copies the description. `toRoutineFields` / `fromRoutineItem` handle `Description`.
- `TaskForm` and `RoutineForm`: show the initial value, submit it trimmed, and block an over-long one.
- `TaskRow`: unfolded shows the description, folded doesn't. `TaskTable`: shows the one-line description.
- `NudgeBanner`: shows it. Pop-up body: has its first line.
- Push and Undo keep the description (`push.ts` result, Undo restore).

**PR 2**
- `CATEGORIES` lists the nine keys in order, and every key has a label and an icon.
- `summarize` and `dayTotals` return all nine keys.
- `fromItem` / `fromRoutineItem`: unknown → `office`, and the old key → `projects` while the read rule exists.
- `findNoBreakRuns`: a `breaks` task splits a run.
- `SummaryView`: new categories show in the bar and legend. `TaskForm` and `RoutineForm` offer nine options.

**Flows** have no automated tests. Each is backed up, deployed, read back, and checked live with TEST-named tasks that are recycled afterwards.

## Risks
- GUESS: Graph reads and writes a plain multi-line text column as a plain string. Checked in the plan's first task.
- GUESS: the app's delegated `Sites.Selected` token can't add columns or choices. Schema changes are done in the SharePoint UI by Shubh, or by Claude in his signed-in Chrome profile.
- The few minutes between rollout steps 2 and 4: the read rule covers them, and Shubh is the only user.
- Nine colours in the summary bar may still be hard to read. The legend covers it, and design-critic reviews the UI before the PR.

## Out of scope
- Clickable links or formatting in descriptions (plain text only).
- Categories edited in Setup (approach C).
- Making the repo private or rewriting git history.
- Reading `DailySummaries` in the app (v2 sub-project 2, Progress).
