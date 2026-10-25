# Day Planner: drag to reorder, and fixed time — design spec

Date: 2026-10-25 · Owner: Shubh · Status: design approved in chat; spec awaiting review

## Goal

When plans change, reshape the day in seconds around what matters. Drag a task up or down and the times follow the new order. Tasks marked **fixed time** (a call, a meeting) never move, and the flexible tasks flow around them.

## Decisions (Shubh, 2026-10-25, in chat)

- **Why:** plans change during the day, what matters should come first, and editing times is fiddly (all three; 5-whys level 1).
- **Priority = the order on screen.** No stored priority number. Routines get no separate priority: their start time places them each morning, and you reorder on the day.
- **Retiming:** the dragged task and the tasks it passes are laid back to back from the earliest of their starts, each keeping its working time. Later tasks move only if they now overlap, using the +30 chain rule.
- **Draggable:** planned, not-started, not-fixed tasks. Done, skipped, started and fixed tasks stay where they are.
- **Fixed time** (Shubh calls it "absolute time") can be set in:
  - the task add/edit sheet (Today and Tomorrow)
  - Table view (a pin per row)
  - routines (the Morning flow copies it)
  - the Teams Add task form
- **A fixed task interrupts a flexible one as a pause.** It stays one task with one set of cards. Its time counts without the pause.
- **The +30 push respects fixed tasks** in the app and on the Teams cards.
- **Where:** the list and Table views, on Today and Tomorrow.
- **Who writes the code:** Claude, test-first ("just write it" for this feature). Shubh approves the spec, plan and PRs.

## Worked examples (these become tests)

1. **Reorder.** A 16:00–17:30 (90 min) and B 17:00–17:30 (30 min). Drag B above A: B becomes 16:00–16:30 and A 16:30–18:00.
2. **Flow around fixed.** A call is fixed at 16:00–16:30, A takes 90 min, and B (30 min) is at 16:30. Move A to start 15:30:
   - A runs 15:30–17:30 and pauses 16:00–16:30 for the call (still 90 min of work)
   - B moves to 17:30–18:00
3. **+30 with fixed.** A ends 15:50 and the call is fixed at 16:00–16:30. +30 on A: A ends 16:50, with 10 min before the call and 20 min after it. The call stays.

## Facts this rests on

- CODE (`src/domain/push.ts`): `pushChain` moves planned, not-started tasks from the anchor by one delta while they touch; it never moves done, skipped or started tasks. `pushTask` is +30 through `extendTask`.
- CODE (`src/domain/extend.ts`): when the press is more than 5 min late, +30 counts from now.
- CODE (`src/domain/summary.ts:19-28`): `plannedMinutes` = start to originalEnd; `spentMinutes` = actual time or planned. Totals, Summary and Week all use these.
- CODE (`src/ui/neu/TaskRow.tsx:68`): rows already use a sideways drag (swipe Done or Skip).
- CODE (`node_modules/framer-motion/.../Reorder/Item.mjs:7`): motion's `Reorder` uses the full `motion` component. The app runs `LazyMotion strict` (`src/ui/neu/MotionPrefs.tsx`), so `Reorder` can't be used; drag is a small pointer handler.
- CODE (`flows/nudges.json`): Teams +30 moves a chain (`Get_chain` → `Apply_to_each_chain`); the Starting-now card re-reads each moved task.

## Design

### Data
- `Task.fixed?: boolean` and `Routine.fixed?: boolean`.
- SharePoint:
  - **Yes/No** column `TaskFixed` (DayPlannerTasks) and `Fixed` (Templates).
  - A create sends `true` only when fixed; an update always sends the value.
  - A missing value or `null` reads as not fixed.

### Domain
- **Pause** (`src/domain/fixed.ts`): `pauses(task, dayTasks)` returns the parts of a flexible task's span that fixed, not-skipped tasks cover, merged and sorted. `pauseMinutes` is their total. A fixed task has no pauses.
- **Working time:** for a flexible task, planned minutes = `plannedMinutes(t)` minus the pause inside start→originalEnd; spent minutes subtract the pause the same way. `summarize`, `dayTotals` and `weekReview` use this. With no fixed tasks every number is the same as today.
- **Flow:** `flowAround(startMs, workMin, fixed)` returns `{ start, end }`.
  - If the start falls inside a fixed block, it starts when the block ends.
  - The work then runs through free time, skipping each fixed block it meets, so the end grows by those blocks.
- **Reorder:** `reorderDay(tasks, movedId, beforeId | null): Task[]` returns the changed tasks.
  - The movable tasks, by start, are the planned, not-started, not-fixed ones.
  - The moved task goes before `beforeId`, or to the end.
  - The segment is the moved task plus the movable tasks between its old and new place. It is re-laid in the new order with `flowAround`, from the earliest start in the segment.
  - Each task keeps its working time. Start, end and originalEnd shift, and originalEnd keeps its offset from end.
  - If the segment now ends later than it did, the later movable tasks re-flow with the chain rule: they move only while they overlap, fixed tasks never move, and they flow around fixed blocks.
- **Moving a start** (Table view's start field, worked example 2) keeps the task's working time and lays it out with `flowAround`. Later tasks re-flow with the chain rule. The Edit sheet keeps the times you type: if the span you type crosses a fixed task, that part shows as a pause and the working time shrinks.
- **+30:** `pushTask` adds 30 working minutes and flows around fixed blocks. Its chain uses the same re-flow. With no fixed tasks the results equal today's (the existing push tests guard this).
- **Overlap warnings:** an overlap between a flexible and a fixed task is a pause, not a warning. Two fixed tasks overlapping, or two flexible ones, still warn as now.

### App UI
- **Forms:** TaskForm and RoutineForm get a switch "Fixed time (meeting, call)".
- **List row:**
  - a 📌 next to the time on fixed tasks
  - flexible tasks with a pause show "Paused 16:00–16:30 · Call"
  - movable rows get a **⋮⋮ handle** (`aria-label` "Reorder <title>")
  - the unfolded row gets **Move up** and **Move down**
- **Dragging:** you hold the handle and move the pointer, and a line shows where the task will land; on release the task is reordered. On the handle, ArrowUp and ArrowDown move the task one place. The handle stops the swipe drag and the tap-to-unfold.
- **Table:** each row gets a pin toggle ("Fixed: <title>"), plus the same handle and keys.
- **Undo:** one Undo restores every task the reorder or push moved. The bar says "Moved B to 16:00 · A now 16:30 · 1 more".
- **Validation:** the form shows "Pauses for Call (16:00–16:30)" as a note, not a warning.

### Flows
- **Morning:** `Create_task` copies the Templates `Fixed` value into `TaskFixed`.
- **Add task:** the form gets an `Input.Toggle` "Fixed time", saved to `TaskFixed`. Quick add gets it through the same form.
- **Nudges cards:** the Starting-now and Time's-up headers show "📌" for fixed tasks.
- **Nudges +30** (the Time's-up push and the Starting-now later-push):
  - fixed tasks are left out of `Get_chain`, so they never move
  - a moved flexible task, and the pushed task itself, that now overlaps a fixed task gets its end extended by that overlap
  - this is **a single pass**, while the app flows around blocks one after another; the two agree for one fixed block per gap
  - backups first, with live checks of the worked examples

### Delivery (3 PRs, in order)
1. **Fixed time:** data, forms, Table pin, row marker and pause line, working-time totals, Morning and Add task flows, card marker, SharePoint columns.
2. **Reorder plus app +30 respecting fixed:** `flowAround`, `reorderDay`, `pushTask` change, the handle, keys, Move up and down, Undo.
3. **Teams +30 respecting fixed:** a `nudges.json` change, live-checked.

## Existing tests

None should change. With no fixed tasks every existing push, totals and summary expectation must hold. If one needs a change, it goes to Shubh first.

## Testing (new, written first)
- `pauses` and `pauseMinutes`: a fixed block inside, partly overlapping and outside; two fixed blocks merged; skipped fixed tasks ignored.
- `flowAround`: no fixed; a start inside a block; work crossing one block and then two.
- Working-time totals subtract pauses (`summarize`, `dayTotals`, `weekReview`).
- `reorderDay`: worked examples 1 and 2.
  - moving down
  - no-op when dropped in place
  - done, started and fixed tasks unmoved
  - a later overlapping task pushed, a later clear one unmoved
- `pushTask`: worked example 3; an existing case with no fixed task is unchanged.
- Mapping and contracts: `TaskFixed` and Templates `Fixed` round-trip.
- UI:
  - the form switch
  - row 📌 and the pause line
  - the Table pin
  - handle keys ArrowUp and ArrowDown, and Move up and down, reorder and save
  - Undo restores
  - a pure `dropIndex(pointerY, rowRects)` for the drag
- Flows: live checks of examples 2 and 3 on Teams cards, plus Morning and Add task carrying `TaskFixed`.

## Out of scope
- Dragging between days (Today → Tomorrow), multi-select, and dragging in the Week view.
- Outlook meetings as fixed tasks (v2 part 4 will reuse `fixed`).
- A stored priority number.
