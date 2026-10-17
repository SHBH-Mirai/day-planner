# Day Planner in Teams with Power Automate — design spec

Date: 2026-10-17 · Owner: Shubh · Status: draft for review

## Goal

Run Day Planner in Teams with Power Automate and SharePoint only: no Azure, no hosted
code, no payment card. Button-driven Adaptive Cards from the Flow bot replace the
bot design in `2026-10-17-teams-bot-design.md`. That design was dropped because it
needs an Azure subscription. The DATA: the SHBH tenant has no billing account, and
Shubh chose not to sign up.

## Facts this rests on

- DOCS ([Teams connector][tc]): no trigger fires on a message sent to the Flow bot. The
  closest trigger, "When a new chat message is added", watches every chat you're in, and the
  connector lists trigger polls at 1 per 600 seconds. So the design uses buttons, not typed commands.
- DOCS ([tc]): Flow bot posts are limited to 25 non-GET calls per 5 minutes per connection.
  That is ample for one user.
- DATA (existing flow "Day Planner - Teams nudges", built and verified 2026-10-17): START
  and STOP cards arrive on time, and Done and Skip write back. See `2026-10-17-teams-nudges-design.md`.
- DATA (2026-10-17): the lists `Settings`, `Templates` and `DailySummaries` exist on
  `/sites/Development`, with the column names below read back from SharePoint.
- GUESS, to verify in plan step 1: a child flow must sit in a Power Automate solution, and a
  solution needs Dataverse in the environment. If it isn't available, the fallback is to copy
  the Add-task steps into the Morning and Evening flows.

## Data (SharePoint, site `/sites/Development`)

| List | Used for | Columns |
|---|---|---|
| `DayPlannerTasks` | tasks (unchanged) | Title, TaskStart, TaskEnd, TaskOriginalEnd, TaskActualStart, TaskActualEnd, TaskCategory, TaskStatus |
| `Settings` | one row, edited by hand in Lists | StartNudges, EndNudges (yes/no), DefaultLengthMin (number). The other columns are unused. |
| `Templates` | recurring tasks, edited by hand in Lists | Title, Category (office/freelance/youtube), StartTime (`HH:mm` IST), DurationMin, Days (multi-choice Mon–Sun), Active |
| `DailySummaries` | history, written by Evening | Title (`yyyy-MM-dd`, the key), Day, PlannedMin, ActualMin, OfficeMin, FreelanceMin, YoutubeMin, Done, Skipped |

All times in SharePoint are UTC. Card text shows India Standard Time as `HH:mm`.

## Flows

### 1. Nudges (upgrade of "Day Planner - Teams nudges")
- Keep the trigger, the trigger condition (`TaskStatus = planned`) and the freshness check
  (`Modified` unchanged, status still planned).
- New: read the `Settings` row first. A switched-off kind of nudge is skipped.
- Two **parallel branches**, so a START card waiting for a press never delays STOP:
  - **START**: runs if `TaskActualStart` is empty and the start is less than 10 minutes ago.
    Delay until `TaskStart`, check freshness, then post and wait for "▶ START: {Title} until
    {TaskEnd}" with a **Started** button. The wait times out at `TaskEnd`. GUESS: if an action
    timeout can't be set by expression, use a fixed 1 h timeout instead. Started sets
    `TaskActualStart = utcNow()`. A timeout ends the branch as success, not failure.
  - **STOP**: as built today. "⏹ STOP: {Title}. Done?" with **Done / +15 min / Skip**.
    - Done sets status done and `TaskActualEnd`.
    - +15 sets `TaskEnd = max(TaskEnd, now) + 15 min`, which starts a new run.
    - Skip sets status skipped.

### 2. Morning (Recurrence, 06:00 India Standard Time)
1. Get active `Templates` whose `Days` contain today's weekday.
2. For each one, create a planned task from today's date with `StartTime` and `DurationMin`,
   unless a task with the same Title and start already exists. That makes a rerun create nothing.
3. Get today's tasks (IST day bounds), sorted by start.
4. Post a card titled "Today · {ddd d MMM}" with one line per task, `HH:mm–HH:mm Title ·
   Category · status`, or "No tasks yet.", plus an **Add task** button. The card waits up to 12 h; a
   press runs the Add task flow, and no press ends the run as success.

### 3. Evening (Recurrence, 22:30 India Standard Time)
1. Get today's tasks (IST day bounds).
2. Work out the summary with the web app's rules (`src/domain/summary.ts`):
   - planned = start → originalEnd
   - actual = (actualStart or start) → actualEnd
   - per category: done tasks count their actual (or planned), planned tasks count planned,
     skipped tasks count 0
   - Done and Skipped counts
3. Create or update the `DailySummaries` row whose Title is today's `yyyy-MM-dd`.
4. Post a card: "Summary · {date}" (one line per task: planned, actual, status; then minutes
   per category), then "Tomorrow" with tomorrow's tasks, and an **Add task** button. The card
   waits up to 2 h, as in Morning.

### 4. Add task (child flow, called by Morning and Evening)
- Post and wait (timeout 2 h) for a form with Title, Date, Start, End and Category.
  - Defaults: the next 5-minute mark for start, plus `DefaultLengthMin` for end. On the
    Evening card the default date is tomorrow, with start 09:00.
- Checks:
  - Title required and end after start. If either fails, re-post the form with the error.
  - Overlap with another planned task that day: save anyway, and the confirmation says
    "⚠ Overlaps {Title} (HH:mm–HH:mm)".
- After a save, post "Saved ✓ {Title} HH:mm–HH:mm" with **Add another**. At most 10 saves per run.
- New tasks get nudges automatically, because the Nudges flow fires on create.

## Rules and duplication

Power Automate can't run `src/domain`. In flow expressions it repeats only end-after-start,
the overlap warning and the summary math. The 3-hour no-break warning stays in the web app
only. This duplication is deliberate and limited to those three.

## Safety and rollback

- Before changing Nudges, save a copy named "Day Planner - Teams nudges (backup 2026-10-17)"
  and turn it off. Rollback means turning the copy on and the new flow off.
- Shubh approves turning flows on or off and every sign-in. Nothing is deleted.

## Testing (as DATA in SharePoint, never assumed)

- **Nudges**: a test task starting in 2 minutes and ending 2 minutes later. Press Started
  (TaskActualStart set), then +15 (new end, new STOP card), then Done (status done,
  TaskActualEnd set). Then a task with StartNudges switched off: no START card.
- **Morning**: a test template for today's weekday. Run Morning twice by hand: one task is
  created and one card arrives each run.
- **Evening**: run by hand. The `DailySummaries` row equals a hand calculation from the
  same tasks. A second run updates the row instead of adding one.
- **Add task**: a valid task is saved; end before start is refused with the error; an
  overlap is saved with the warning.
- Afterwards, test items and the test template are deleted with Shubh's OK (careful mode).

## Out of scope
- Typed commands, editing or deleting tasks from Teams (done in the SharePoint list), the
  no-break warning in Teams, template or settings cards, changing the Teams catalog app.
- The `feat/teams-bot` branch stays on GitHub unmerged, as a reference.

[tc]: https://learn.microsoft.com/en-us/connectors/teams/
