# Teams nudges — design spec

Date: 2026-10-17 · Owner: Shubh · Status: built and verified 2026-10-17 (START/STOP on time, Done and Skip write back; +15 still to be confirmed)

> Updated 2026-10-17: the flow now has a **Started** button, reads `Settings`, and runs
> START and STOP in parallel (see `2026-10-17-power-automate-planner-design.md`). +15 verified.

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

## Flow: "Day Planner - Teams nudges" (as built 2026-10-17)

1. **Trigger:** SharePoint "When an item is created or modified" on
   `DayPlannerTasks`, polled every minute. Trigger condition:
   `TaskStatus = planned`, so done and skipped updates never start a run.
2. **Start nudge:** runs only if `TaskActualStart` is empty and `TaskStart` is in
   the future or less than 10 minutes ago.
   - Delay until `TaskStart`. Get the item. Continue only if its `Modified` equals
     the trigger's `Modified` (no newer change, so a newer run owns it) and the status
     is still planned.
   - Post a card (**no wait**): "▶ START: {Title} until {TaskEnd IST}" with an
     "Open Day Planner" button. Changed from the first design: a waiting START card
     that was ignored would time out and fail the run, which would also kill
     the STOP nudge.
3. **End nudge:** Delay until `TaskEnd`. Get the item. Same freshness check, and the
   end must be less than 10 minutes in the past.
   - Post a card and wait (1 h): "⏹ STOP: {Title}. Done?" with **Done / +15 min / Skip**
     and "Open Day Planner".
   - Update item from the answer (`data.choice` or `submitActionId`):
     - done sets `TaskStatus = done` and `TaskActualEnd = utcNow()`
     - plus15 sets `TaskEnd = max(TaskEnd, now) + 15 min`, which starts a new run
     - skip sets `TaskStatus = skipped`
4. The freshness check uses `Modified`, not just start and end, so renaming
   a task while a run waits doesn't produce duplicate nudges.

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
