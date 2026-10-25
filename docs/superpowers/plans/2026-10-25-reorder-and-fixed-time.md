# Drag to reorder and fixed time — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fixed-time tasks that never move (flexible tasks pause around them), then drag-to-reorder that re-times tasks around them.

**Architecture:**
- **PR 1 (fixed time)** adds `fixed` from the data through the forms, rows, Table view, totals and the 3 flows.
- **PR 2** adds `flowAround`, `reorderDay`, a fixed-aware `pushTask`, and the drag/keys/move UI.
- **PR 3** brings the same +30 rule to the Teams nudges flow.

**Tech Stack:** React 19, TypeScript, Vitest 5 + RTL (IST), motion `m.*` (LazyMotion strict), Graph/SharePoint, Power Automate.

**Spec:** `docs/superpowers/specs/2026-10-25-reorder-and-fixed-time-design.md`

## Global Constraints
- **Copy, exact:**
  - "Fixed time (meeting, call)" (form switch)
  - "Fixed: <title>" (Table pin)
  - "Pauses for <title> (HH:mm–HH:mm)" (row; Shubh changed it from "Paused HH:mm–HH:mm · <title>" after the design review)
  - "Pauses for <title> (HH:mm–HH:mm)" (form note)
  - "Reorder <title>" (handle)
  - "Move up", "Move down"
- A fixed task never moves through reorder, +30 or chain moves. Only a direct edit of that task changes it.
- With no fixed tasks, every existing number and behaviour stays the same; existing tests are the guard.
- Existing tests stay unchanged; any change goes to Shubh first.
- Flows: backup, PATCH with If-Match, read-back hash, live check. SharePoint changes add only. Recycling TEST rows needs Shubh's OK.
- Never push, merge or open a PR without Shubh's word. Public wording rules apply. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus
1. **Two fixed blocks inside one flexible task:** pauses merge and minutes subtract both. → Task 2 test.
2. **A skipped fixed task** isn't a pause. → Task 2 test.
3. **An old item with no `TaskFixed` value** (null or missing) reads as not fixed and never breaks a save. → Task 1 test.
4. **A fixed task that overlaps another fixed task** still warns; flexible + fixed shows a note instead. → Task 2 test.
5. **Clearing fixed in an edit** saves `false` (not left as true). → Task 1 and Task 3 tests.

---

# PR 1 — Fixed time (branch `feat/fixed-time`)

### Task 1: The `fixed` field end to end in storage
**Files:**
- `src/domain/task.ts`, `src/domain/routine.ts`
- `src/storage/sharePointMapping.ts`, `src/storage/routineMapping.ts`
- tests appended to `src/storage/sharePointMapping.test.ts`, `src/storage/routineRepository.test.ts`, `src/storage/repositoryContract.ts`, `src/storage/routineContract.ts` and `src/domain/routine.test.ts`

**Produces:**
- `Task.fixed?: boolean`; `TaskDraft` gains `fixed?: boolean`
- `Routine.fixed?: boolean`
- `TaskFields.TaskFixed?: boolean | null`
- A create sends `TaskFixed: true` only when fixed; an update always sends `TaskFixed: !!task.fixed`. Reads are `true` only for `true`.
- Routines follow the same rule with `Fixed` (`toRoutineFields(r, mode)`).
- `routineToDraft` copies `fixed` when it's true.

- [ ] **Tests:**
  - **Mapping:** toFields for a fixed task gives `TaskFixed` true; a non-fixed draft omits it; a non-fixed task (update) sends false. fromItem reads true, false, null and missing correctly.
  - **Routine mapping:** the same pairs.
  - **Contract:** create fixed, then update to not fixed → listed `fixed` is falsy (both twins). The same for routines.
  - **`routineToDraft`:** a fixed routine → a fixed draft.
- [ ] RED, then implement, then GREEN. Commit `feat(storage): fixed time on tasks and routines`.

### Task 2: Pauses, working time and overlap notes
**Files:** create `src/domain/fixed.ts` and `src/domain/fixed.test.ts`; modify `src/domain/summary.ts`, `src/ui/neu/totals.ts`, `src/domain/progress.ts` and `src/domain/validate.ts`.

**Produces:**
- `pauses(task: Task, dayTasks: Task[]): { from: string; to: string; title: string }[]`: merged parts of the flexible task's start→end covered by fixed tasks that aren't skipped. A fixed task has none.
- `pauseMinutes(task, dayTasks, untilIso?)`: total pause minutes up to `untilIso`, which defaults to `task.end`.
- `pauseNotes(draft: TaskDraft, others: Task[]): string[]`: "Pauses for <title> (HH:mm–HH:mm)", one per fixed task the draft overlaps (only when the draft isn't fixed).
- `validateTask` skips the overlap warning for a flexible-and-fixed pair. Fixed+fixed and flexible+flexible still warn.
- **Totals:** `summarize`, `dayTotals` and `weekReview` subtract a flexible task's pause from its planned minutes (up to `originalEnd`) and from its spent minutes (inside actualStart→actualEnd when Started, else within the planned span).

- [ ] **Tests:**
  - **`pauses` and `pauseMinutes`:** a call 16:00–16:30 inside A 15:30–17:30 → one pause of 30 min; partly overlapping; outside; two fixed blocks (merged, total); a skipped fixed task is ignored; a fixed task itself has no pauses.
  - **Totals:** a day of call (fixed, 30) + A (15:30–17:30, done without Started) → done 90 + 30 and planned 120 (not 150).
  - **`pauseNotes`:** returns the note. **`validateTask`:** a flexible draft over a fixed task gets no "Overlaps" warning; two fixed tasks still warn; existing cases unchanged.
- [ ] RED, then implement, then GREEN. Run the full suite (existing totals, summary and validate tests unchanged). Commit `feat(domain): fixed tasks pause the flexible ones`.

### Task 3: UI for fixed time
**Files:**
- `src/ui/TaskForm.tsx`, `src/ui/RoutineForm.tsx`, `src/ui/neu/TaskRow.tsx`, `src/ui/TaskTable.tsx`, `src/ui/TodayView.tsx` and `src/ui/theme.css`
- tests appended to `TaskForm.test.tsx`, `RoutineForm.test.tsx`, `TaskRow.test.tsx`, `TaskTable.test.tsx` and `TodayView.test.tsx`

**Consumes:** Task 1 fields, Task 2 `pauses` / `pauseNotes`.

**Produces:**
- **Forms:** a switch "Fixed time (meeting, call)" (the existing `Switch`). Drafts always carry `fixed: boolean`. The TaskForm shows `pauseNotes` below the warnings.
- **TaskRow:**
  - takes an optional `pauses` prop
  - fixed tasks show 📌 (`aria-label` "Fixed time")
  - a flexible task with pauses shows "Pauses for <title> (HH:mm–HH:mm)"
- **TaskTable:** a pin toggle per row, `aria-pressed` and label "Fixed: <title>", calling `onToggleFixed(task)`.
- **TodayView:** passes `pauses(task, shown.tasks)` to each row; `onToggleFixed` saves `{ ...task, fixed: !task.fixed }` with Undo.

- [ ] **Tests:**
  - **Forms:** the switch shows the initial value, submits `fixed`, and clearing it submits `false`.
  - **TaskForm:** shows the pause note.
  - **TaskRow:** 📌 on fixed; the pause line on flexible.
  - **TaskTable:** the pin toggles.
  - **TodayView:** toggling fixed in Table view saves to the repo.
- [ ] RED, then implement, then GREEN. Full suite, lint, tsc and build. Commit `feat(ui): fixed time in forms, rows and Table view`.

### Task 4: SharePoint and flows (no code test)
- [ ] **Step 1:** Add **Yes/No** columns `TaskFixed` (DayPlannerTasks) and `Fixed` (Templates), default No, via SharePoint REST. Check with a TEST task saved fixed from the branch app on localhost: it reads back `TaskFixed: true`.
- [ ] **Step 2:** Hash-check the live flows against `main`, then edit the exports (Write-tool script, same format):
  - **Morning `Create_task`:** `item/TaskFixed` = `@equals(items('Each_template')?['Fixed'], true)`
  - **Add task:**
    - `Init_fixed` (boolean false)
    - an `Input.Toggle` id `fixed` "Fixed time" after Category in `Form_card`, with value `@{variables('fixed')}` and `valueOn` "true" / `valueOff` "false"
    - `Keep_fixed` = `@equals(body('Post_form')?['data']?['fixed'], 'true')`
    - `Create_task` `item/TaskFixed` = `@variables('fixed')`
    - `Next_fixed` resets it to false
  - **Nudges `Start_card` / `Stop_card`:** the header TextBlock text gets a prefix, `@{if(equals(body('Get_item_…')?['TaskFixed'], true), '📌 ', '')}`.
  - Static check (`flowcheck.py`) OK.
- [ ] **Step 3:** Deploy the 3 flows: backups "(backup before fixed time)", If-Match PATCH, read-back hash = repo.
- [ ] **Step 4: live checks.**
  - F1: a TEST fixed task's Starting-now card shows 📌.
  - F2: the Add task form saves a fixed task (`TaskFixed` true).
  - F3: a TEST fixed routine → Morning copies `TaskFixed`. Definition-only unless a safe manual run is possible.
- [ ] **Step 5:** README and setup-doc lines; commit `feat(flows): fixed time in Morning, Add task and card headers`.

### Task 5: Review and PR 1
- [ ] Run phase-reviewer and design-critic; one fix pass test-first; ledger the minors.
- [ ] Ask Shubh to push, open and merge PR 1. Then check the deploy and live site, write the QA doc and version log, update State, and recycle TEST rows (with his OK).

---

# PR 2 — Reorder and app +30 respecting fixed (branch `feat/reorder`, from `main` after PR 1)
Outline (full tasks are written when PR 1 merges):
- **Domain:**
  - `flowAround(startMs, workMin, fixed)`
  - `reorderDay(tasks, movedId, beforeId)`
  - `pushTask` flowing around fixed tasks
  - a start move in Table view that keeps working time
  - worked examples 1–3 as tests; the existing push tests must stay green unchanged
- **UI:**
  - a ⋮⋮ handle with pointer drag and a drop line (`dropIndex` pure helper)
  - ArrowUp and ArrowDown on the handle; Move up and Move down in the unfolded row
  - Table handle
  - one Undo for every moved task, with message copy

# PR 3 — Teams +30 respecting fixed (branch `feat/teams-fixed`, after PR 2)
Outline:
- Leave fixed tasks out of `Get_chain`.
- Extend a moved flexible task's end, and the pushed task's end, by its overlap with fixed tasks (a single pass).
- Live-check worked examples 2 and 3 on Teams cards.
