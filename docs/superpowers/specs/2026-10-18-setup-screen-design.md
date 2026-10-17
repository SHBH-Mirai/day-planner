# Day Planner v2, sub-project 1: Setup (Settings + Routines) — design spec

Date: 2026-10-18 · Owner: Shubh · Status: design approved in chat; spec awaiting review

## Context: the v2 roadmap (approved 2026-10-18)

| # | Sub-project | Features |
|---|---|---|
| **1** | **Setup (this spec)** | Settings screen, Routines screen |
| 2 | Progress | Weekly review, Streaks |
| 3 | Feel | Focus mode, interaction animations, subtle background animation (off switch, off in Focus mode, off under reduced motion) |
| 4 | Outlook | Office meetings shown as blocked time (`Calendars.Read`) |

Each sub-project has its own spec, plan and build. Claude writes the code test-first ("just write it", Shubh 2026-10-18). Shubh approves each spec and plan, and any change to an existing test.

## Goal

Manage the planner's settings and routines inside the app, instead of editing SharePoint lists by hand.

## Facts this rests on

- CODE (flows/*.json): the SharePoint lists on `/sites/Development` are:
  - **Settings**: `fc63f483-9505-4589-a627-11c6d2930fef`. Nudges and Add task read `StartNudges`, `EndNudges` and `DefaultLengthMin`.
  - **Templates**: `13b87cf1-fe6c-4753-8a0a-b51245cb2f64`. Morning reads `Title`, `Category`, `StartTime`, `DurationMin`, `Days` and `Active`.
  - **DailySummaries**: `45d16b27-f8e1-48b4-9b1c-8f0070ffeb4b`. Used by sub-project 2.
- CODE (flows/morning.json):
  - Morning runs at 06:00 IST. It keeps templates whose `Days` contains today's `ddd` value (`Mon`…`Sun`) and whose `Active` is 1, then creates tasks.
  - It skips a template when a task with the same Title and start already exists.
  - `Category` is a choice with the values `office`, `freelance` and `youtube`.
- CODE (deploy.yml): the app receives its SharePoint IDs from GitHub repo variables (`VITE_SP_SITE_ID`, `VITE_SP_LIST_ID`) and from `.env.local` locally.
- GUESS, to check in the first plan task (DOCS): the shapes Graph reads and writes for these SharePoint column types:
  - **multi-choice** (`Days`): read as a string array; a write needs `"Days@odata.type": "Collection(Edm.String)"`;
  - **yes/no** (`Active`, the nudge switches): read and written as booleans;
  - **choice** (`Category`): read and written as a plain string.

## Design

### 1. Data
- **`src/storage/graphRequest.ts`**: the Graph request helper moves out of `SharePointTaskRepository`. It covers the Bearer token, the 30 s timeout, and mapping errors to `RepositoryError`. Behaviour stays the same, and the existing repository tests guard the move.
- **Settings** (`src/storage/settings*.ts`):
  - `Settings = { startNudges: boolean; endNudges: boolean; defaultLengthMin: number }`
  - `SettingsRepository = { get(): Promise<Settings>; save(s: Settings): Promise<void> }`
  - There is one row. `get` reads the first row and falls back to the defaults `{ true, true, 30 }` when there is none. `save` updates that row, or creates it if it is missing.
  - The app writes only `StartNudges`, `EndNudges` and `DefaultLengthMin`. The flows' own columns (such as `FiredKeys` and `ConversationId`) are never written.
  - SharePoint and in-memory versions share one contract test.
- **Routines** (`src/storage/routine*.ts`):
  - `Routine = { id; title; category: Category; startTime: 'HH:mm'; durationMin: number; days: Weekday[]; active: boolean }`
  - `Weekday = 'Mon'|'Tue'|'Wed'|'Thu'|'Fri'|'Sat'|'Sun'`
  - `RoutineRepository = { list(); create(draft); update(r); remove(id) }`
  - `remove` deletes the item, which sends it to the SharePoint recycle bin.
  - SharePoint and in-memory versions share one contract test.
- **Config**: add `VITE_SP_SETTINGS_LIST_ID` and `VITE_SP_TEMPLATES_LIST_ID`.
  - They go in `.env.local`, in `vite-env.d.ts`, and as GitHub repo variables. Claude sets the repo variables once the plan is approved.
  - Memory mode uses the in-memory repositories.

### 2. Rules (`src/domain/routine.ts`, pure, tested on their own)
- `validateRoutine(draft)`: returns error messages. The title is required, the time must be `HH:mm`, the length must be 5–720 minutes, and at least one day must be picked.
- `routineToDraft(routine, day)`: returns a `TaskDraft` that starts on `day` at `startTime` local time and lasts `durationMin`, in the routine's category.
- `isOnDay(routine, day, tasks)`: true when a task with the same title and start already exists. This is the same rule the Morning flow uses.

### 3. Screens
- **Header gear** (`aria-label="Setup"`): opens **Setup** in place of the day content, the same way Summary does. **Back** returns to the previous view.
- **Nudges & defaults**:
  - Two switches: "Start cards in Teams" and "Stop cards in Teams".
  - A default-length choice: 15 · 30 · 45 · 60 · 90 min.
  - Changes save immediately and show a short "Saved" note. A failure shows the error and Retry.
  - The **+** task form's default length comes from `defaultLengthMin`, through a new `TaskForm` prop that defaults to 30, so existing tests are unchanged.
- **Routines**:
  - Each row shows the title, `HH:mm · 45m`, and day chips M T W T F S S, with the active days highlighted.
  - Each row has an **Active** switch, **Add to today**, **Edit**, and **Delete**.
  - **Add to today** creates today's task through the existing task list. If the routine is already on today, it says "Already on today" instead.
  - **Delete** asks "Delete <title>? It goes to the SharePoint recycle bin."
  - **+ New routine** and **Edit** open the shared `Sheet` with a `RoutineForm`: title, category, start time, length, and day chips. Validation errors show inline.
- **Style**: same neumorphic theme, motion and keyboard support as the rest of the app. The switches are real `role="switch"` buttons.

## Testing (TDD; Claude writes each failing test first)
- **Rules**: validation cases, `routineToDraft` across the day boundary, and `isOnDay`.
- **Repositories**: a shared contract for each repository, run against the in-memory version and the SharePoint version with a fake Graph. The SharePoint tests also check:
  - the PATCH writes only the 3 settings fields;
  - the multi-choice write format for `Days`;
  - a missing settings row falls back to the defaults, then is created on save.
- **Screens**:
  - the gear opens Setup and Back returns;
  - a toggle saves;
  - choosing a length saves and the + form then uses it;
  - routine add, edit and delete (with confirm);
  - the Active switch;
  - Add to today, both for a new task and for one already on today.
- Changes to any existing test need Shubh's approval first.
- Checked in the browser in memory mode, then against the real lists in Teams.

## Out of scope (later sub-projects)
- The background-animation off switch (sub-project 3 adds it here).
- Weekly review and streaks (2), Focus mode (3), Outlook (4).

## Risks
- The Graph field formats for multi-choice and yes/no columns are a GUESS until checked against the docs in plan task 1.
- Two writers to Settings: the app saves while a nudge run reads it. The app never touches the flows' columns, so this is safe; last save wins on the 3 app fields.
