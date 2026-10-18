# Day Planner: Task table and push chain — design spec

Date: 2026-10-18 · Owner: Shubh · Status: design approved in chat; spec awaiting review

## Goal

Show the whole day in one card and change it there. Each row can be ticked done, renamed, moved, lengthened, pushed, skipped or removed, on both Today and Tomorrow. Pushing a task also moves the tasks lined up right behind it.

## Decisions (Shubh, 2026-10-18, in chat)

- **Placement:** inside the app, not in a Teams card.
- **When it's used:** all day. Morning replanning, during the day, the evening tidy-up, and planning tomorrow.
- **Switch:** a **List | Table** switch above the tasks, remembered on this device. The calm list stays available.
- **Row controls:** Done tick, rename in place, start time, length, **+30**, Skip/Unskip, Remove.
- **Push size:** +30 min replaces +15 everywhere in the app. A push moves the touching chain of later tasks by the same amount. Moving a task earlier or shortening it never pulls other tasks back.
- **Who writes the code:** decided at the plan handoff. Teach mode is the default; "just write it" overrides it.

## Facts this rests on

- CODE (`src/ui/TodayView.tsx:350-375`): list rows save through `shown.save` and `shown.remove`. Done and Skip set an Undo. Delete asks first, using `window.confirm` (`src/ui/neu/TaskRow.tsx:45-46`).
- CODE (`src/domain/extend.ts:12-25`): `extendTask(task, minutes, all, now)`
  - moves the end, counting from *now* if the task has run late beyond the grace period;
  - keeps `originalEnd`;
  - *returns* the planned tasks it now overlaps but moves none of them.
- CODE (`src/ui/TodayView.tsx:313-317`): in the Edit sheet, changing the times counts as a re-plan, so `originalEnd` follows. Any other edit keeps `originalEnd`. Planned minutes are measured from start to `originalEnd` (`src/domain/summary.ts:20`).
- CODE (`flows/nudges.json`): the nudge flow fires whenever a task is created or changed (`GetOnUpdatedItems`). GUESS, to check in the live test: moved tasks therefore get fresh start and stop cards.
- CODE (`flows/nudges.json`): the **+15 min** button on the Teams Time's-up card extends only its own task. This spec doesn't change it (see Out of scope).

## Design

### 1. The push rule (`src/domain/push.ts`, pure)

`pushChain(before: Task, after: Task, all: Task[]): Task[]` returns the *other* tasks that move, already shifted.

- `delta` = end of `after` minus end of `before`. If `delta` ≤ 0, nothing moves.
- **Candidates:** the other tasks in `all` that are `planned` and start at or after `before`'s end, sorted by start.
- **Walk:**
  1. Start with `frontier` = `after`'s end.
  2. A candidate that starts before `frontier` moves: its `start`, `end` and `originalEnd` all shift by `delta`. Then `frontier` becomes whichever is later: itself or that task's new end.
  3. The first candidate that starts at or after `frontier` stops the walk. It stays put, and so does everything after it.
- Done, skipped and started tasks never move and never block the chain.
- A partial overlap still moves by the full `delta`. For example, B ends at 11:00, C starts at 11:15, and a 30-minute push moves C by 30.
- The function never changes its inputs.

Mockup example: A 09:00–09:30, B 09:30–10:00, C 10:00–11:30, D 14:00. Pressing +30 on A moves B to 10:00 and C to 10:30. D stays.

### 2. +30 everywhere in the app

- `PUSH_MIN = 30` in the domain. Three places use it:
  - the list row's button, renamed from **+15 min** to **+30 min** (prop `onPlus15` becomes `onPush`);
  - the in-app nudge banner's end nudge (also **+30 min**);
  - the table's **+30**.
- **All three behave the same way:**
  1. `updated = extendTask(task, PUSH_MIN, all, now)`. This is an overrun, so `originalEnd` stays.
  2. `moved = pushChain(task, updated, all)`.
  3. Save `updated`, then each moved task.
- **The message goes in the Undo bar:** "{title}: extended to HH:MM. Moved B, C by N min." When nothing moves, it says "…Nothing else moves." instead. N is the real `delta`, so a late push can say more than 30.
- **Undo** restores the pushed task and every moved task to their copies from before the push.

### 3. The table (`src/ui/TaskTable.tsx`)

The table is one card with one row per task, sorted by start, just like the list. Each row:

| Control | What it does |
|---|---|
| Done tick | Ticking does exactly what the list's Done does: `done`, actual end = now, Undo. Unticking a done task sets it back to `planned` and clears its actual end. |
| Title | A text box. Enter or clicking away saves the trimmed title. An empty title or Esc puts the old one back. |
| Start | A time box. Enter or clicking away commits it. The length stays the same. It counts as a re-plan, so `originalEnd` follows. If the end moves later, `pushChain` runs. |
| Length | A minutes box, from 5 to 720. Enter or clicking away commits it. It counts as a re-plan, so `originalEnd` follows. If the end moves later, `pushChain` runs. An out-of-range value puts the old one back. |
| +30 | Does the push from section 2. |
| Skip / Unskip | Skip works like the list's Skip, with Undo. Unskip sets the task back to `planned`. |
| Remove | Asks "Delete "{title}"?" like the list, then removes the task. |

- **Done and skipped rows** are dimmed. Their start, length and +30 controls are disabled; their tick, Unskip, title and Remove still work.
- **A start or length change that pushes others** gets the same Undo bar message and Undo as a push.
- **Labels:** every control's accessible name includes the task title, for example "Start: Flow fixes".
- **Phone width** (< 560 px): each row wraps onto two lines (title row, then controls), with no sideways scroll.
- **Motion:** when a time changes, the rows slide to their new places. The existing reduced-motion setting turns this off.
- **Empty day:** shows the same empty message as the list.

### 4. The switch (`src/ui/ViewSwitch.tsx`)

- A **List | Table** segmented control above the tasks. It shows on Today and Tomorrow, and hides in Summary and Setup.
- Your choice is remembered in `localStorage` under `dayPlanner.view` (`list` | `table`), defaulting to `list`. Every read and write is wrapped in try/catch, so the switch still works when storage is blocked.
- The + button, the focus strip, the nudge banner and the Undo bar don't change.

### 5. Errors

- Every save goes through the existing path: one save at a time per task, with the error bar and Retry if it fails.
- A push saves several tasks. If one of them fails, the error bar shows, and tasks that already saved stay moved. There is no automatic rollback; Undo still works.
- On Tomorrow, the chain only looks at that day's tasks.

## Existing tests that change (Shubh approves each before it's edited)

| File:line | Test | Change |
|---|---|---|
| `src/ui/neu/TaskRow.test.tsx:51` | keeps its actions folded away until the row is tapped | button name `+15 min` → `+30 min` |
| `src/ui/neu/TaskRow.test.tsx:63` | runs each folded action | clicks `+30 min`; calls `onPush` |
| `src/ui/NudgeBanner.test.tsx:34` | an end nudge offers Done, +15 min and Skip | `+30 min` |
| `src/ui/NudgeBanner.test.tsx:42` | +15 min shows the new end and what it pushes back | `+30 min`; message now says what moved |
| `src/ui/TodayView.neu.test.tsx:124` | +15 min in a row says the new end and what it pushes back | `+30 min`; "Moved …" instead of "Now overlaps …" |
| `src/ui/TodayView.neu.test.tsx:212` | +15 min in the row pushes the end back by 15 minutes | 30 minutes |
| `src/ui/TodayView.nudges.test.tsx:49` | +15 min extends the task and shows what it pushes back | `+30 min`; moved tasks |

Unchanged: `src/domain/extend.test.ts`, because `extendTask` keeps its `minutes` parameter.

## Testing (new tests, written first)

- **`push.test.ts`:**
  - delta ≤ 0 moves nothing;
  - a touching chain moves;
  - the walk stops at a big enough gap;
  - a partial overlap moves by the full amount;
  - done, skipped and started tasks stay put;
  - moved tasks shift `originalEnd` too;
  - inputs are unchanged;
  - a late push uses the real delta.
- **`TaskTable.test.tsx`:**
  - each control does what the table in section 3 says;
  - Esc, an empty title and an out-of-range length all revert;
  - done and skipped rows disable their controls;
  - Remove asks first;
  - labels name the task.
- **`ViewSwitch.test.tsx`:**
  - the choice is remembered;
  - the switch still works when storage throws.
- **TodayView:**
  - the switch shows the table on Today and Tomorrow, and not in Summary or Setup;
  - +30 in the table moves the chain, and Undo restores all of it;
  - the list's +30 behaves the same.

## Out of scope

- The Teams Time's-up card's +15 (a Power Automate flow change). Possible follow-up: make it +30 and push the chain too.
- Pulling tasks earlier, multi-select, and drag-to-reorder.
