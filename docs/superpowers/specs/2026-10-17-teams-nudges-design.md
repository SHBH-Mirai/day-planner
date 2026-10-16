# Teams nudges — design spec

Date: 2026-10-17 · Owner: Shubh · Status: approved in chat (2026-10-17 02:5x IST)

## Purpose

Get Day Planner's start/end nudges in Microsoft Teams, even when the web app is
closed. This removes v1's biggest limit for desktop and phone (Teams mobile).

## Decisions

| Topic | Decision |
|---|---|
| Engine | Power Automate cloud flow (no code), in the datenshi tenant |
| Delivery | 1:1 chat with the Flow bot |
| Teams tab | Not now: MSAL redirect sign-in is unlikely to work inside a Teams iframe (GUESS); cards link to the web app instead |
| Card timeout | 1 hour, then the run ends; the task stays as it is |
| Browser nudges | Kept; an app setting to switch them off comes after the deferred-fixes session |
| Data | Same SharePoint list `DayPlannerTasks` (site `/sites/Development`) |

## Flow: "Day Planner – Teams nudges"

1. **Trigger:** SharePoint "When an item is created or modified" on
   `DayPlannerTasks`. Every change starts a new run.
2. **Guard:** stop unless `TaskStatus = planned`. Keep `startAtTrigger = TaskStart`
   and `endAtTrigger = TaskEnd`.
3. **Start nudge**, only if `TaskActualStart` is empty and `TaskStart` is in the future
   or less than 10 minutes ago:
   - Delay until `TaskStart` (UTC).
   - Get item. Stop if status ≠ planned or `TaskStart` ≠ `startAtTrigger`
     (a newer run owns it).
   - Post adaptive card and wait (1 h): "▶ START: {Title} until {TaskEnd local}",
     with a **Started** button that writes `TaskActualStart = utcNow()`.
4. **End nudge:**
   - Delay until `TaskEnd`.
   - Get item. Stop if status ≠ planned or `TaskEnd` ≠ `endAtTrigger`.
   - Post adaptive card and wait (1 h): "⏹ STOP: {Title}. Done?"
     - **Done** sets `TaskStatus = done` and `TaskActualEnd = utcNow()`.
     - **+15 min** sets `TaskEnd = max(TaskEnd, now) + 15 min`. That edit starts a new
       run, which nudges at the new end; this run stops.
     - **Skip** sets `TaskStatus = skipped`.
5. Every card carries an "Open Day Planner" link to
   `https://shbh-mirai.github.io/day-planner/`.

## Known behaviour and limits

- Writes made by the flow (Started/Done/+15) also trigger the flow. The guard and
  stale checks make those runs end early, at a small cost in actions.
- One run can wait at most 30 days, so only tasks planned less than 30 days ahead nudge.
- Licensing and limits are GUESS until checked: SharePoint and Teams are standard
  connectors included with M365 business plans; about 6,000 actions per day.
- Times: SharePoint gives UTC; card text converts to India Standard Time.

## Test

Create a task starting in 2 minutes and ending 2 minutes later. Check that both
cards arrive in Teams (desktop and mobile). Press Started, then +15: check the new
end in SharePoint and that a new STOP card arrives at the new end. Press Done:
check the status and actual end in SharePoint.
