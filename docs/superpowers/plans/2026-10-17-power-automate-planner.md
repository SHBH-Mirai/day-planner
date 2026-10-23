# Day Planner in Teams with Power Automate: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Four Power Automate flows (Nudges, Morning, Evening, Add task) that run Day Planner in Teams on SharePoint only.

**Architecture:** Cloud flows in the datenshi default environment post Adaptive Cards as the Flow bot in Shubh's 1:1 chat. They read and write the four SharePoint lists on `/sites/Development`. Add task is a child flow inside a solution, called by Morning and Evening.

**Tech Stack:** Power Automate cloud flows (SharePoint, Microsoft Teams, Schedule connectors), Adaptive Cards 1.4, built in Chrome.

**Spec:** `docs/superpowers/specs/2026-10-17-power-automate-planner-design.md`

## Global Constraints
- No Azure, no hosted code, no payment. Standard connectors only.
- The builder is Claude, in Shubh's Chrome (his usual profile). Shubh approves each sign-in or connection consent and each flow switched on or off. Nothing is deleted without "I confirm".
- Time zone: `India Standard Time` in every Recurrence and every `convertFromUtc`/`convertTimeZone`. SharePoint stores UTC.
- IST day bounds:
  - from: `convertToUtc(formatDateTime(convertFromUtc(utcNow(),'India Standard Time'),'yyyy-MM-dd'),'India Standard Time')`
  - to: the same plus `addDays(…,1)`
  - filter: `TaskStart ge '<from>' and TaskStart lt '<to>'`
- Card copy, exact strings:
  - START: `▶ START: {Title} until {HH:mm}`, button `Started`.
  - STOP: `⏹ STOP: {Title}. Done?`, buttons `Done`, `+15 min`, `Skip`.
  - Today: `Today · {ddd d MMM}`. Task line: `{HH:mm}–{HH:mm} {Title} · {Category} · {status}`. Empty day: `No tasks yet.` Button: `Add task`.
  - Evening: `Summary · {ddd d MMM}`, then `Tomorrow`.
  - Add: `Saved ✓ {Title} {HH:mm}–{HH:mm}`, `⚠ Overlaps {Title} ({HH:mm}–{HH:mm})`, `End must be after start`, `Title is required`, button `Add another`.
- Lists: DayPlannerTasks f0d2c452-c1da-4f3d-8e74-ff03feeb5f77, Settings fc63f483-9505-4589-a627-11c6d2930fef, Templates 13b87cf1-fe6c-4753-8a0a-b51245cb2f64, DailySummaries 45d16b27-f8e1-48b4-9b1c-8f0070ffeb4b.
- Every check is DATA: read the SharePoint item or the flow run history, never assume.

## Review Focus
1. **A START card ignored for the whole task:** the run must end as Succeeded and STOP must still arrive on time (Task 2, test 2b).
2. **Morning rerun or retry:** the second run creates no duplicate template tasks (Task 4, test 4b).
3. **Evening rerun:** the DailySummaries row is updated, never duplicated (Task 5, test 5b).
4. **Midnight IST:** a task at 00:30 IST belongs to that IST day in Morning, Evening and the Add defaults (Task 5, test 5c: a task at 00:30 IST counts in that day's summary).
5. **Settings row missing or a nudge switched off:** missing means nudges on. Off means no card of that kind (Task 2, test 2d).

---

### Task 1: Feasibility checks and settings row
**Files:** spec only, and only if a fallback is taken.
- [ ] **1a Dataverse/solutions:** in make.powerautomate.com (default environment) → Solutions, create the solution `DayPlanner` (publisher: default).
  Expected: created. If it needs Dataverse provisioning or a licence, take the fallback: Add task steps are copied into Morning and Evening, and the spec's Facts line is updated. Ledger it as a ruling.
- [ ] **1b Dynamic timeout:** in a scratch flow, set the "Post adaptive card and wait for a response" action's Settings → Timeout to an expression (`PT2M`, built by expression).
  Expected: it saves, and a test run times out after about 2 min. Otherwise use a fixed `PT1H` for START. Delete the scratch flow only with Shubh's "I confirm".
- [ ] **1c Settings row:** create one row in `Settings`: Title `Shubh`, StartNudges yes, EndNudges yes, DefaultLengthMin 30. Read it back (DATA).
- [ ] **1d** Commit any spec update: `docs: Power Automate feasibility results`.

### Task 2: Nudges upgrade
**Interfaces:** consumes the Settings row from 1c. Produces: none.
- [ ] **2a Backup:** Save As "Day Planner - Teams nudges (backup 2026-10-17)" and turn it off (Shubh's OK).
  Expected: the copy is listed as Off and the original as On.
- [ ] **2b Edit the original:**
  - After the trigger, add "Get items" on Settings (top 1) and Compose `startOn`: `coalesce(first(body('Get_settings')?['value'])?['StartNudges'], true)`. Do the same for `endOn`.
  - Move the existing START and STOP blocks into two parallel branches.
  - START: condition `startOn` and the existing guards. Replace "post card" with "Post adaptive card and wait for a response", card copy as above, button `Started` (data `{ "choice": "started" }`), timeout from 1b.
    - On a response: Update item `TaskActualStart = utcNow()`, but only if the item is still planned and `TaskActualStart` is empty (Get item first).
    - Configure "run after: has timed out" on a final Compose so a timeout ends as Succeeded.
  - STOP: condition `endOn` around the existing branch. Nothing else changes.
- [ ] **2c Test** (a task starting now+2 min and ending now+4 min):
  - START arrives → press Started → `TaskActualStart` set (DATA).
  - STOP arrives → +15 → TaskEnd is +15 (DATA), and a new STOP arrives → Done → status done and `TaskActualEnd` set (DATA).
- [ ] **2d Test:** a second task, START ignored. The run history shows the START branch timed out, STOP arrived, and the run Succeeded. Then set StartNudges = no and create a third task: no START card, STOP still arrives. Set StartNudges back to yes.
- [ ] **2e** Commit the nudges spec update (`2026-10-17-teams-nudges-design.md`: Started button, parallel branches, Settings): `docs: nudges flow with Started and settings`.

### Task 3: Add task (child flow, in solution `DayPlanner`)
**Interfaces:**
- Produces: child flow "Day Planner - Add task"
  - inputs `date` (text `yyyy-MM-dd`) and `start` (text `HH:mm`)
  - output `saved` (number)
- [ ] **3a Build:**
  - Trigger: Manually trigger a flow, inputs `date` and `start`.
  - Read DefaultLengthMin from Settings (default 30).
  - Do until `saved = 10 or stop = true`, with the loop limit at 20:
    - Post the form and wait (`PT2H`): Title (required), Date (default `date`), Start (default `start`), End (default start + DefaultLengthMin), Category (office/projects/youtube, default office). Buttons: `Save`, `Cancel`.
    - Cancel or timeout sets stop = true.
    - Convert the IST date and time to UTC with `convertToUtc('{date}T{time}:00','India Standard Time')`.
    - If the title is empty or end ≤ start, re-post with the error line. Otherwise Get items for that IST day (planned only), Filter array for overlaps (`start < other.end and other.start < end`), and Create item (status planned, `TaskOriginalEnd = TaskEnd`).
    - Post `Saved ✓ …` plus overlap lines.
  - Respond to a PowerApp or flow: `saved`.
- [ ] **3b Test** (run the child flow by hand with today's date):
  - Valid input → item exists with the right UTC times (DATA).
  - End before start → `End must be after start` and no item (DATA).
  - An overlap → saved, with the `⚠ Overlaps` line.
  - The new task gets its START nudge from Task 2's flow.

### Task 4: Morning
**Interfaces:** consumes the child flow from Task 3.
- [ ] **4a Build:**
  - Trigger: Recurrence daily 06:00, time zone India Standard Time.
  - Today's weekday: `formatDateTime(convertFromUtc(utcNow(),'India Standard Time'),'ddd')`.
  - Templates: Get items `Active eq 1`, then Filter array where `Days` contains the weekday.
  - For each template:
    - start = `convertToUtc('{today}T{StartTime}:00','India Standard Time')`.
    - Skip it if today's tasks include the same Title and the same start (compare `ticks`).
    - Otherwise Create item, with end = start + DurationMin.
  - Get today's tasks, ordered by TaskStart. Post a card (copy as above) and wait 12 h with button `Add task`.
  - On a press: run the child flow with date = today and start = the next 5-minute mark, IST.
  - A timeout ends as Succeeded.
- [ ] **4b Test:** a template for today's weekday at now+30 min. Run by hand twice: one task exists (DATA) and two cards arrive. Press Add task → the form arrives.

### Task 5: Evening
**Interfaces:** consumes the child flow from Task 3.
- [ ] **5a Build:**
  - Trigger: Recurrence daily 22:30, India Standard Time.
  - Get today's tasks. In Apply to each (concurrency 1), with integer variables:
    - plannedMin += minutes(start → originalEnd)
    - if actualEnd: actualMin += minutes((actualStart or start) → actualEnd)
    - category: done adds actual (or planned), planned adds planned, skipped adds 0
    - count done and skipped
    - minutes = `div(sub(ticks(b),ticks(a)),600000000)`
  - Get items in DailySummaries where `Title eq '{yyyy-MM-dd}'`. Update the row if it exists, otherwise Create it. Day = `{yyyy-MM-dd}T00:00:00Z`.
  - Get tomorrow's tasks.
  - Post a card and wait 2 h: summary lines (`{Title}: planned {n} · actual {n or –} min · {status}`), the category lines, `Tomorrow` with its task lines, and button `Add task`.
  - On a press: run the child flow with date = tomorrow and start = `09:00`.
- [ ] **5b Test:** with today's test tasks (one done, one skipped, one planned), run twice. One row exists and its numbers equal the hand calculation written in the ledger (DATA).
- [ ] **5c Test:** a task at 00:30 IST today counts in today's row.

### Task 6: Finish
- [ ] **6a:** README section "Teams (Power Automate)": the four flows, the lists, editing Templates and Settings in Lists, and the web app as fallback.
- [ ] **6b:** List the test items and the test template, and delete them after Shubh's "I confirm" (careful mode).
- [ ] **6c:** Commit, push the branch, open a PR, and merge it after Shubh's OK. (Root tests are unchanged: `npx vitest run` → 136 pass.)
