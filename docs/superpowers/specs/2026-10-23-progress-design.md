# Day Planner v2, sub-project 2: Progress (weekly review + streaks) — design spec

Date: 2026-10-23 · Owner: Shubh · Status: decided by delegation. Shubh, 2026-10-23 21:15 IST: "complete all work, don't wait for my decisions". Every choice below is a ruling for him to review afterwards.

## Goal

See where the week's time actually went, and keep momentum from day to day. This goal is a GUESS: Shubh was away, so the 5-whys couldn't run with him. It's taken from the v2 roadmap row "Progress: Weekly review, Streaks" and from the app's purpose, an ADHD-friendly daily planner.

## Rulings (made in Shubh's absence)

| # | Decision | Why | Cost if wrong |
|---|---|---|---|
| R1 | A fourth **Week** segment in the view switch: Today · Tomorrow · Summary · Week | Same place as Summary, no new navigation | A segment to move |
| R2 | Read the **tasks list**, not `DailySummaries` | It includes today live, counts done work only, and uses the Summary screen's counting rules. `DailySummaries` mixes planned minutes into the category totals | A second source to reconcile later |
| R3 | The week runs **Monday to Sunday**, local time (IST for Shubh) | Matches the Days order in routines | One constant |
| R4 | Compare with **last week up to the same weekday**, not the whole of last week | A Wednesday doesn't lose to a full week | Copy change only |
| R5 | A **streak** is consecutive days with at least one task done. Today extends it once a task is done, and doesn't break it before then | It shouldn't show 0 every morning | Rule tweak |
| R6 | **Category streaks**: the same rule per category, shown from 2 days up. Breaks & meals are excluded | A meal streak isn't progress | Filter tweak |
| R7 | **Look back 28 days**, shown as "28+" at the cap. One query covers this week, the comparison and the streaks | Bounded load (about 15 tasks a day) | A longer query |
| R8 | **App only**: no flow, card or SharePoint change | Nothing live can break; the 22:30 Evening run is untouched | A Shutdown-card streak line later |
| R9 | **Claude writes the code**, test-first ("complete all work" counts as "just write it" for this feature) | Shubh is away | Teach mode next time |

## Facts this rests on

- CODE (`src/ui/neu/totals.ts`): `dayTotals(tasks)` gives planned minutes, done (spent) minutes, done and skipped counts. The focus strip and the Summary use the same numbers.
- CODE (`src/domain/summary.ts`): `spentMinutes` is real time when Started was pressed, otherwise the planned length.
- CODE (`src/storage/SharePointTaskRepository.ts:24`): `listForDay` filters `TaskStart` from local midnight to the next midnight and follows `@odata.nextLink`.
- CODE (`src/ui/TodayView.tsx:83,299,412`): the Summary segment is a `showSummary` flag that hides the focus strip and the List/Table switch and renders `SummaryView`.
- DATA (SharePoint, 2026-10-23): 51 tasks since 2026-10-16, so 28 days is a few hundred items at most.

## Design

### Data
- `TaskRepository.listRange(from: Date, days: number): Promise<Task[]>` returns tasks starting from local midnight of `from` for `days` days, sorted by start. It's in the in-memory and SharePoint repos and in the shared contract. The SharePoint `listForDay(day)` becomes `listRange(day, 1)`.

### Domain (`src/domain/progress.ts`)
- `STREAK_LOOKBACK_DAYS = 28`
- `weekStart(day: Date): Date` is local Monday 00:00 of `day`'s week.
- `weekReview(tasks, today): WeekReview` has:
  - `days`: Monday to Sunday, each with doneMin, plannedMin, doneCount, skippedCount and `future`
  - the week's totals
  - `perCategoryDone`: done minutes only
  - `lastWeekDoneMin`: last week, Monday up to today's weekday
- `streaks(tasks, today, lookbackDays = 28): Streaks` returns `{ days, capped, byCategory: { category, days }[] }`. `byCategory` excludes `breaks`, keeps 2 days and up, and sorts by days, then by category order.

### UI (`src/ui/WeekView.tsx`, `src/ui/useTaskRange.ts`)
- **Loading:** `useTaskRange(repo, from, days)` loads once per open. It shows "Loading your week…". If loading fails it shows the message "Couldn't load your week." with a **Retry** button.
- **Heading:** "This week", with the range ("Mon 19 Oct – Sun 25 Oct").
- **Stat tiles** (the Summary's `.stat` style):
  - **Focus** = done time, with "+1h 20m vs last week", "−20m vs last week" or "Same as last week"
  - **Done**
  - **Skipped**
- **Focus by day:** a 7-item list, Monday to Sunday. Each bar's height follows done minutes relative to the week's best day. Today is marked and future days are muted. Each item is labelled like "Monday: 2h 10m done of 3h planned".
- **Where the time went:** the Summary's category bar and legend (icons included), fed with done minutes only.
- **Streaks:**
  - "🔥 N-day streak" (or "28+"), or "No streak yet. Tick a task done today to start one."
  - one chip per category streak, e.g. "🎬 Content · 5 days"

### Integration (`TodayView`)
- A `showWeek` flag next to `showSummary`. Exactly one of Today, Tomorrow, Summary and Week is pressed at a time. Week hides the focus strip and the List/Table switch, as Summary does.
- `.day-switch` gets 4 columns.

## Testing (new tests, written first)
- `weekStart`: Monday maps to itself, Sunday maps to 6 days earlier, and midnight edges hold.
- `weekReview`:
  - day buckets and future flags
  - done-only category minutes
  - skipped tasks are counted but add no minutes
  - the last-week span follows today's weekday
- `streaks`:
  - an empty history gives 0
  - a run ending yesterday counts when today has nothing done yet
  - a gap stops it
  - the cap reads `capped`
  - category streaks skip `breaks` and drop 1-day runs
- Repository contract `listRange`: day bounds, order, multi-day ranges.
- `WeekView`: stats and the vs-last-week text, the day bars' labels, category bar, streak text and chips, loading and error with Retry.
- `TodayView`: the Week segment shows WeekView and hides the focus strip, and Today brings the list back.
- No existing test changes.

## Out of scope
- Streak or week lines on Teams cards; reading `DailySummaries`; goals and targets per category; month views; charts beyond the bars.
