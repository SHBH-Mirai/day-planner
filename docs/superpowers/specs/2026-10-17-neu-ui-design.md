# Day Planner neumorphic UI — design spec

Date: 2026-10-17 · Owner: Shubh · Status: draft, awaiting review

## Goal

Rebuild the Day Planner web app's interface as an animated, interactive,
minimalist **neumorphic** planner, shown inside Teams as a personal app tab.
It keeps the same features and data as before; only the interface changes.
Shubh writes the code (teacher mode, TDD), so the work is also React/TypeScript practice.

## Decisions (Shubh, 2026-10-17)

| Topic | Decision |
|---|---|
| Platform | React web app as a Teams personal tab (chosen over Power Apps) |
| Scope v1 | Restyle the existing screens: Today, Tomorrow, add/edit, summary, nudge banner |
| Animation | `motion` library, pinned at `13.5.1` |
| Theme | Follows Teams: light, dark, high contrast |
| Interactions | Tap to tick done, swipe actions, tap row to expand, slide-up add sheet |
| Approach | Building blocks first, then swap screens one at a time; logic layer untouched |

## Facts this rests on

- DATA (npm, 2026-10-17): `motion` 13.5.1 was published 2026-10-02; peer deps are `react ^18 || ^19`.
  14.x is less than two weeks old, so it is not used yet.
- CODE: `useTasks(repo, day)` returns `{ tasks, error, needsSignIn, retry, add, save, remove, createdCount, reload }`;
  `useToday()` returns the current day. Both stay unchanged.
- CODE: NAA sign-in for Teams (`src/auth/host.ts`, `createMsal(config, 'teams')`) and the
  `teams-app/` package already exist. The org catalog entry was deleted on 2026-10-17 and must be re-uploaded.
- CODE: the category value stays `youtube`; its label becomes **Content** (matching the Teams cards).

## Design

### 1. Theme (`src/ui/theme.css`, rewritten)
- Shared tokens: `--neu-bg`, `--neu-light` (highlight shadow), `--neu-dark` (low shadow),
  `--neu-text`, `--neu-muted`, `--neu-accent` (`#5B8DEF`).
- Light set = the mockup's soft grey (`#E6E9EF`, shadows `#ffffff` / `#c4c8d0`).
- Dark set = deep slate with matching soft shadows (exact values picked against a screenshot).
- `data-theme` on `<html>`: `light | dark | contrast`.
  - In Teams it is set from TeamsJS `app.getContext().app.theme` (`default→light`, `dark`, `contrast`)
    and updated by `app.registerOnThemeChangeHandler`.
  - In a browser, `prefers-color-scheme` decides.
- `contrast` turns neumorphism off: flat surfaces, 2px solid borders, no shadows.
- `prefers-reduced-motion: reduce` makes every animation a short fade.

### 2. Building blocks (`src/ui/neu/`, each with a test file)

| Component | Props (key ones) | Behaviour |
|---|---|---|
| `NeuSurface` | `variant: 'raised' \| 'inset'`, `as?` | soft raised or pressed panel |
| `NeuButton` | `onClick`, `pressed?`, `aria-label?` | presses in when tapped, with a small spring |
| `ProgressRing` | `done: number`, `total: number` | springs to `done/total`; `aria-label` like "2 of 5 done" |
| `TaskRow` | `task`, `isNow`, `onDone`, `onStarted`, `onPlus15`, `onSkip`, `onEdit` | circle tap → `onDone`; row tap toggles an expanded bar (Started / +15 / Skip / Edit); swipe right past 30% of the width → `onStarted` (or `onDone` if already started), swipe left past 30% → `onSkip`; `isNow` shows a pulsing outline |
| `Sheet` | `open`, `onClose`, `title`, `children` | slides up; traps focus while open; Esc and backdrop click close it |
| `Fab` | `onClick`, `aria-label` | floating round **+** button |

Every swipe action is also a button in the expanded bar, so mouse and keyboard can do everything.

### 3. Screens
- **Today** (home):
  - date heading with `ProgressRing`
  - a "Focus today: done min / planned min" inset strip
  - a timeline of `TaskRow`s in time order
  - the no-break warning as an amber pill
  - `Fab`
- **Tomorrow:** a segmented Today ⇄ Tomorrow switch (the pressed-in pill slides); the same timeline, without the ring.
- **Add / edit:** `TaskForm` inside a `Sheet`. Category is three chips (Office · Freelance · Content).
  Validation is unchanged: end after start; overlap and no-break warnings.
- **Summary:** the third tab. Big planned vs actual numbers, a stacked category bar, done/skipped counts.
- **Nudge banner** (browser only): drops in from the top with a spring.
- **Motion:** a ticked task glides to done; added tasks slide in; removed tasks collapse;
  tab content slides sideways.

### 4. Data flow (unchanged)
UI event → screen handler → `useTasks.save/add/remove` → `src/domain` rules
(validate, extend with grace, summary) → SharePoint via Graph. The error banners and
the pending-save queue keep their behaviour, with the new styling.

### 5. Teams tab
- Bump `teams-app/manifest.json` `version` to 1.1.0 and run `npm run teams:zip`.
- Shubh re-uploads the zip to the org catalog and pins it (his click).
- Verify on Teams desktop and Teams mobile.

## Testing (TDD; Shubh writes each failing test first)
- **Building blocks:**
  - `ProgressRing` shows the percentage and `aria-label`.
  - `TaskRow`: circle → `onDone`; row tap expands to 4 buttons; Esc collapses; a swipe past the threshold calls the right handler and a short swipe calls none.
  - `Sheet`: opens and closes, focus stays inside, Esc closes.
  - `NeuButton`: the pressed state is exposed (`aria-pressed` when toggled).
- **Theme:** Teams theme `dark` → `data-theme="dark"`; `contrast` → `contrast`; a theme change handler updates it. TeamsJS is mocked.
- **Motion in tests:** `MotionGlobalConfig.skipAnimations = true` in `setupTests`, so tests check
  outcomes, not timing.
- **Existing tests** (TodayView, TaskForm, SummaryView, NudgeBanner) are the "features still work"
  contract. If the new markup breaks one, stop and explain to Shubh before changing it.

## Order of work
1. Branch `feat/neu-ui` (done); install `motion@13.5.1`; motion test config.
2. Theme tokens and Teams theme following.
3. `NeuSurface`, `NeuButton`.
4. `ProgressRing`.
5. `TaskRow`: tick, then expand, then swipe.
6. `Sheet` and `Fab`; `TaskForm` moved into the sheet.
7. Today and Tomorrow screen.
8. Summary screen.
9. Teams package bump and zip; Shubh re-uploads; desktop and mobile check.
10. PR, then merge with Shubh's OK.

## Out of scope
Templates and Settings screens, drag to reschedule, focus mode, morning ritual (possible v2).

## Risks (GUESS until checked)
- Swipe inside the Teams desktop frame may clash with Teams gestures. Fallback: swipe on touch devices only.
- Dark neumorphism can look muddy. Check with a screenshot after step 2 before building further.
- `MotionGlobalConfig.skipAnimations` is the documented way to switch animations off in tests, as I recall it. Check it in step 1.
