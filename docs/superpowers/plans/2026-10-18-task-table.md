# Task Table + Push Chain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or superpowers:subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a List | Table switch so the day can be edited in one card: done, rename, start, length, +30, skip, remove. Make +30 push the touching chain of later tasks everywhere in the app.

**Architecture:** The push rule is pure domain code in `src/domain/push.ts`. `TaskRow`, `NudgeBanner` and the new `TaskTable` only *report* intent through callbacks. `TodayView` owns every save and the Undo, through one set of shared handlers, so the list and the table behave the same way. The view choice lives in `localStorage` behind a tiny module.

**Tech Stack:** React 19, TypeScript, Vitest + RTL (tests run in IST), motion (`m` + LazyMotion with the `domMax` features already loaded for `layoutId`).

**Spec:** `docs/superpowers/specs/2026-10-18-task-table-design.md`

## Global Constraints
- **Who writes the code:** decided at the handoff. In teach mode Shubh writes, and Claude explains, outlines and reviews. TDD either way.
- **Existing tests:** only the 7 approved tests change, plus the 2 setup-helper lines they depend on (`TaskRow.test.tsx:22`, `NudgeBanner.test.tsx:18`). Any other edit to an existing test needs Shubh's OK first.
- **Push size:** `PUSH_MIN = 30`. Pushes count from now when the task is more than 5 min late (the existing `extendTask` rule).
- **Undo bar message** (exact):
  - "`{title}`: ends at HH:MM. Moved B, C by N min."
  - "`{title}`: ends at HH:MM. Nothing else moves."
- **Nudge banner inline text** (exact):
  - "Extended to HH:MM. Moved: B, C"
  - "Extended to HH:MM. Nothing else moves."
- **Stored view choice:** key `dayPlanner.view`, value `list` | `table`, default `list`. Every storage call is wrapped in try/catch.
- **Length:** 5–720 min. The phone layout applies below 560 px.
- **Accessible names** include the task title:
  - `Done: {title}`, `Title: {title}`, `Start: {title}`, `Length (min): {title}`
  - `+30 min: {title}`, `Skip: {title}`, `Unskip: {title}`, `Remove: {title}`
- **UI rules:**
  - Elements use `m.*`, never `motion.*`.
  - The theme tokens are `--neu-*`.
  - Styles go in `src/ui/theme.css`.
- **Git:** branch `feat/task-table`. Push, PR and merge only with Shubh's OK.
- **Commands:**
  - one file: `npx vitest run <file>`
  - all tests: `npm test`
  - also before the end: `npm run lint` and `npm run build`

## Review Focus
1. **Typing in the start box.** A half-typed time must not save or push. It commits once, on Enter or when you leave the box. Test in Task 4.
2. **A chain that runs past midnight** (23:00 task, +30). The moved task ends the next day and is still returned. Test in Task 1.
3. **Undo after a moved task was deleted or edited.** The push's Undo is dropped, so it can't restore a stale task. Test in Task 2.
4. **Two +30s in a row.** The second push starts from the first one's positions, so the chain moves 60 in total. Test in Task 5.
5. **Moving a task earlier.** Nothing else moves, the rows re-sort, and no Undo appears. Test in Task 5.

---

### Task 1: The push rule (domain)

**Files:**
- Create: `src/domain/push.ts`
- Test: `src/domain/push.test.ts`

**Interfaces:**
- Consumes: `extendTask(task, minutes, all, now)` from `src/domain/extend.ts` (unchanged); `formatLocalTime(iso)` from `src/domain/time.ts`.
- Produces:
  - `PUSH_MIN = 30`
  - `pushChain(before: Task, after: Task, all: Task[]): Task[]`
  - `pushTask(task: Task, all: Task[], now: Date): { updated: Task; moved: Task[]; deltaMin: number }`
  - `describePush(title: string, newEnd: string, moved: Task[], deltaMin: number): string`

- [ ] **Step 1: Write the failing tests** (`D = '2026-10-17'`, `at = (title, from, to, over = {}) => makeTask({ title, start: ist(D, from), end: ist(D, to), ...over })`)

```ts
describe('pushChain', () => {
  test('nothing moves when the end does not move later', () => {
    const a = at('A', '09:00', '09:30'), b = at('B', '09:30', '10:00')
    expect(pushChain(a, a, [a, b])).toEqual([])
    expect(pushChain(a, { ...a, end: ist(D, '09:15') }, [a, b])).toEqual([])
  })
  test('moves the touching chain by the same amount and stops at the first gap', () => {
    const a = at('A', '09:00', '09:30'), b = at('B', '09:30', '10:00'), c = at('C', '10:00', '11:30'), d = at('D', '14:00', '15:00')
    const moved = pushChain(a, { ...a, end: ist(D, '10:00') }, [a, b, c, d])
    expect(moved.map((t) => [t.title, t.start, t.end, t.originalEnd])).toEqual([
      ['B', ist(D, '10:00'), ist(D, '10:30'), ist(D, '10:30')],
      ['C', ist(D, '10:30'), ist(D, '12:00'), ist(D, '12:00')],
    ])
  })
  test('a partial overlap still moves by the full amount', () => {
    const a = at('A', '09:00', '10:00'), b = at('B', '10:00', '11:00'), c = at('C', '11:15', '11:45')
    const moved = pushChain(a, { ...a, end: ist(D, '10:30') }, [a, b, c])
    expect(moved.map((t) => [t.title, t.start])).toEqual([['B', ist(D, '10:30')], ['C', ist(D, '11:45')]])
  })
  test('done, skipped and started tasks never move or block the chain', () => {
    const a = at('A', '09:00', '09:30')
    const done = at('Done', '09:30', '09:40', { status: 'done' })
    const skipped = at('Skipped', '09:30', '09:40', { status: 'skipped' })
    const started = at('Started', '09:30', '09:40', { actualStart: ist(D, '09:30') })
    const b = at('B', '09:45', '10:15')
    expect(pushChain(a, { ...a, end: ist(D, '10:00') }, [a, done, skipped, started, b]).map((t) => t.title)).toEqual(['B'])
  })
  test('a chain that runs past midnight still moves', () => {
    const a = at('A', '23:00', '23:30'), b = at('B', '23:30', '23:50')
    const [m] = pushChain(a, { ...a, end: ist('2026-10-18', '00:00') }, [a, b])
    expect([m.start, m.end]).toEqual([ist('2026-10-18', '00:00'), ist('2026-10-18', '00:20')])
  })
  test('does not change its inputs', () => {
    const a = at('A', '09:00', '09:30'), b = at('B', '09:30', '10:00')
    const all = [a, b], copy = structuredClone(all)
    pushChain(a, { ...a, end: ist(D, '10:00') }, all)
    expect(all).toEqual(copy)
  })
})

describe('pushTask', () => {
  test('gives the task 30 more minutes, keeps its originalEnd, and moves the chain', () => {
    const s = at('Standup', '09:00', '09:15'), r = at('Review', '09:20', '10:00')
    const { updated, moved, deltaMin } = pushTask(s, [s, r], new Date(ist(D, '09:10')))
    expect(PUSH_MIN).toBe(30)
    expect([updated.end, updated.originalEnd]).toEqual([ist(D, '09:45'), ist(D, '09:15')])
    expect(moved.map((t) => [t.title, t.start, t.end])).toEqual([['Review', ist(D, '09:50'), ist(D, '10:30')]])
    expect(deltaMin).toBe(30)
  })
  test('a late push moves the chain by the real delta', () => {
    const a = at('A', '09:00', '09:30'), b = at('B', '09:30', '10:00')
    const { updated, moved, deltaMin } = pushTask(a, [a, b], new Date(ist(D, '09:42')))
    expect(updated.end).toBe(ist(D, '10:12'))
    expect(deltaMin).toBe(42)
    expect(moved[0].start).toBe(ist(D, '10:12'))
  })
})

describe('describePush', () => {
  test('names what moved and by how much', () => {
    const b = at('B', '10:00', '10:30'), c = at('C', '10:30', '11:00')
    expect(describePush('Standup', ist(D, '09:45'), [b, c], 30)).toBe('Standup: ends at 09:45. Moved B, C by 30 min.')
  })
  test('says when nothing else moves', () => {
    expect(describePush('Standup', ist(D, '09:45'), [], 30)).toBe('Standup: ends at 09:45. Nothing else moves.')
  })
})
```

- [ ] **Step 2: Run** `npx vitest run src/domain/push.test.ts`. Expected: FAIL, because `./push` can't be resolved.

- [ ] **Step 3: Implement `src/domain/push.ts`**
  - `pushChain` follows spec §1.
    - Candidates are tasks with `status === 'planned'`, no `actualStart`, a different `id`, and `start >= before.end`, sorted by start.
    - Walk them with a `frontier`. Shift `start`, `end` and `originalEnd` by the same number of milliseconds.
  - `pushTask` = `extendTask(task, PUSH_MIN, all, now)`, then `pushChain(task, updated, all)`. `deltaMin` is the rounded minutes between the old end and the new end.

- [ ] **Step 4: Run** `npx vitest run src/domain/push.test.ts`. Expected: 10 pass.

- [ ] **Step 5: Commit** `feat(domain): +30 push moves the touching chain`

---

### Task 2: +30 replaces +15 in the list row and the nudge banner

**Files:**
- Modify: `src/ui/neu/TaskRow.tsx`. Line 29 is the doc comment. Lines 126 and 31 rename the prop `onPlus15` to `onPush` and the label to `+30 min`.
- Modify: `src/ui/NudgeBanner.tsx:8-29, 87-89`. `ExtendResult` becomes `{ newEnd: string; moved: Task[] }`, with the new inline text and the `+30 min` label.
- Modify: `src/ui/TodayView.tsx`:
  - Undo state (line 97);
  - `dropUndoFor` (line 101);
  - `onExtend` (lines 270-276);
  - the row `onPlus15` (lines 360-365).
- Test (approved edits only): `src/ui/neu/TaskRow.test.tsx:22,58,68,73`, `src/ui/NudgeBanner.test.tsx:18,34,42-46`, `src/ui/TodayView.neu.test.tsx:124-130,212-222`, `src/ui/TodayView.nudges.test.tsx:49-58`.
- Test (new): `src/ui/TodayView.neu.test.tsx`

**Interfaces:**
- Consumes: `pushTask`, `describePush` (Task 1).
- Produces, inside `TodayView`, for Task 5:
  - `undo: { taskIds: string[]; message: string; restore: () => void } | null`
  - `push(task: Task): { newEnd: string; moved: Task[] }`. It saves the updated task and every moved one, and sets the Undo with `describePush(...)`.
  - `dropUndoFor(id)` clears the Undo when `id` is in `taskIds`.
  - `TaskRow` prop: `onPush: () => void`.

- [ ] **Step 1: Edit the approved existing tests to the new behaviour** (exact new values)
  - **`TaskRow.test.tsx`:**
    - helper `onPlus15: vi.fn()` → `onPush: vi.fn()`;
    - the names `'+15 min'` → `'+30 min'` (lines 58 and 68);
    - `h.onPlus15` → `h.onPush` (line 73).
  - **`NudgeBanner.test.tsx`:**
    - the mock (line 18) returns `{ newEnd: ist(D, '10:30'), moved: [lunch] }`;
    - test 34 is retitled `'an end nudge offers Done, +30 min and Skip'`;
    - test 42 is retitled `'+30 min shows the new end and what moved'`. It clicks `'+30 min'` and expects `'Extended to 10:30. Moved: Lunch'`.
  - **`TodayView.neu.test.tsx`:**
    - test 124 is retitled `'+30 min in a row says the new end and what moved'`. It clicks `'+30 min'` and expects `'Standup: ends at 09:45. Moved Review by 30 min.'`;
    - test 212 is retitled `'+30 min in the row pushes the end back by 30 minutes'`. It expects `end === ist(D, '09:45')` and the card text `'09:00–09:45'`.
  - **`TodayView.nudges.test.tsx`:** test 49 is retitled `'+30 min extends the task and moves what it touches'`.
    - It clicks `'+30 min'` and expects `'Extended to 10:30. Moved: Lunch'`.
    - Deep work: `{ end: ist(D, '10:30'), originalEnd: ist(D, '10:00') }`.
    - Lunch: `{ start: ist(D, '10:30'), end: ist(D, '11:00') }`.

- [ ] **Step 2: Add the new tests** to `TodayView.neu.test.tsx`

```ts
test('Undo after +30 puts the pushed task and every moved task back', async () => {
  const repo = await seeded(['Standup', '09:00', '09:15'], ['Review', '09:20', '10:00'])
  render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
  await userEvent.click(within(await findCard('Standup')).getByRole('button', { name: /Standup/ }))
  await userEvent.click(within(await findCard('Standup')).getByRole('button', { name: '+30 min' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Undo' }))
  await waitFor(async () => {
    const [s, r] = await repo.listForDay(DAY)
    expect([s.end, r.start, r.end]).toEqual([ist(D, '09:15'), ist(D, '09:20'), ist(D, '10:00')])
  })
})

test('deleting a task the push moved drops the Undo', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  const repo = await seeded(['Standup', '09:00', '09:15'], ['Review', '09:20', '10:00'])
  render(<TodayView repo={repo} day={DAY} now={() => NOW} />)
  await userEvent.click(within(await findCard('Standup')).getByRole('button', { name: /Standup/ }))
  await userEvent.click(within(await findCard('Standup')).getByRole('button', { name: '+30 min' }))
  await userEvent.click(within(await findCard('Review')).getByRole('button', { name: /Review/ }))
  await userEvent.click(within(await findCard('Review')).getByRole('button', { name: 'Delete' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument())
})
```

- [ ] **Step 3: Run** `npx vitest run src/ui/neu/TaskRow.test.tsx src/ui/NudgeBanner.test.tsx src/ui/TodayView.neu.test.tsx src/ui/TodayView.nudges.test.tsx`. Expected: the 7 edited tests and the 2 new ones FAIL; everything else passes.

- [ ] **Step 4: Implement**
  1. Rename the prop and label in `TaskRow`.
  2. Change `ExtendResult` and the inline text in `NudgeBanner`.
  3. In `TodayView`, add `push(task)`, used by both the row and `onExtend`. Change the Undo to `taskIds: string[]`; its `restore` saves the copies from before the push. The old `notice` text for +15 goes away; the Undo bar carries the message.

- [ ] **Step 5: Run** the same command, then `npm test`. Expected: all pass.

- [ ] **Step 6: Commit** `feat(ui): +30 in the list and nudges pushes the chain, with Undo`

---

### Task 3: View choice and the List | Table switch

**Files:**
- Create: `src/ui/dayView.ts`, `src/ui/ViewSwitch.tsx`
- Test: `src/ui/dayView.test.ts`, `src/ui/ViewSwitch.test.tsx`

**Interfaces:**
- Produces:
  - `type DayView = 'list' | 'table'`
  - `DAY_VIEW_KEY = 'dayPlanner.view'`
  - `readDayView(): DayView`
  - `saveDayView(v: DayView): void`
  - `ViewSwitch({ value, onChange }: { value: DayView; onChange: (v: DayView) => void })`. It renders `role="group"` with `aria-label="View"` and two `NeuButton`s, **List** and **Table**, with `pressed` on the current one.

- [ ] **Step 1: Write the failing tests** (`beforeEach(() => localStorage.clear())`, `afterEach(() => vi.restoreAllMocks())`)

```ts
test('defaults to list', () => expect(readDayView()).toBe('list'))
test('remembers table', () => { saveDayView('table'); expect(readDayView()).toBe('table') })
test('an odd stored value reads as list', () => { localStorage.setItem(DAY_VIEW_KEY, 'grid'); expect(readDayView()).toBe('list') })
test('blocked storage still works', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
  expect(readDayView()).toBe('list')
  expect(() => saveDayView('table')).not.toThrow()
})
// ViewSwitch.test.tsx
test('shows List and Table, marks the current one, and reports a change', async () => {
  const onChange = vi.fn()
  render(<ViewSwitch value="list" onChange={onChange} />)
  const group = screen.getByRole('group', { name: 'View' })
  expect(within(group).getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(within(group).getByRole('button', { name: 'Table' }))
  expect(onChange).toHaveBeenCalledWith('table')
})
```

- [ ] **Step 2: Run** `npx vitest run src/ui/dayView.test.ts src/ui/ViewSwitch.test.tsx`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** both files, plus the `.view-switch` styles in `theme.css` (the same segmented look as the day switch).
- [ ] **Step 4: Run** the same command. Expected: 5 pass.
- [ ] **Step 5: Commit** `feat(ui): List | Table switch, remembered on this device`

---

### Task 4: The task table

**Files:**
- Create: `src/ui/TaskTable.tsx`
- Modify: `src/domain/time.ts`, adding `withLocalTime`. Modify `src/ui/theme.css`, adding `.task-table`.
- Test: `src/ui/TaskTable.test.tsx`, `src/domain/time.test.ts`

**Interfaces:**
- Consumes: `formatLocalTime`, `minutesBetween` (`src/domain/time.ts`).
- Produces:
  - `withLocalTime(iso: string, hhmm: string): string`. It returns the same local day at `hhmm`, as a UTC ISO string.
  - `TaskTable(props: TaskTableProps)`, where:

```ts
interface TaskTableProps {
  tasks: Task[]
  isNow: (t: Task) => boolean
  onDone: (t: Task) => void
  onUndone: (t: Task) => void
  onSkip: (t: Task) => void
  onUnskip: (t: Task) => void
  onRename: (t: Task, title: string) => void
  onReplan: (t: Task, start: string, end: string) => void
  onPush: (t: Task) => void
  onRemove: (t: Task) => void
}
```

The table never saves anything itself. Rows are `m.li` with `layout`, `role="article"` and `aria-label={title}`, sorted by start. Each control's name follows the Global Constraints. Done and skipped rows disable Start, Length and +30. Done rows also disable Skip. Skipped rows show **Unskip** in place of **Skip**.

- [ ] **Step 1: Write the failing tests** (`D = '2026-10-17'`; tasks `s = makeTask({ id: 's', title: 'Standup', start: ist(D,'09:00'), end: ist(D,'09:30') })`, `r = makeTask({ id: 'r', title: 'Review', start: ist(D,'10:00'), end: ist(D,'11:00') })`; a `setup(tasks)` helper renders with `vi.fn()` handlers and returns them)

```ts
test('withLocalTime keeps the day and sets the time', () =>
  expect(withLocalTime(ist(D, '09:00'), '10:15')).toBe(ist(D, '10:15')))   // in time.test.ts

test('one row per task in start order, with every control named for its task', () => {
  setup([r, s])
  expect(screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual(['Standup', 'Review'])
  expect(screen.getByRole('checkbox', { name: 'Done: Standup' })).not.toBeChecked()
  expect(screen.getByRole('textbox', { name: 'Title: Standup' })).toHaveValue('Standup')
  expect(screen.getByLabelText('Start: Standup')).toHaveValue('09:00')
  expect(screen.getByRole('spinbutton', { name: 'Length (min): Standup' })).toHaveValue(30)
  for (const name of ['+30 min: Standup', 'Skip: Standup', 'Remove: Standup']) expect(screen.getByRole('button', { name })).toBeEnabled()
})
test('ticking calls onDone; unticking a done task calls onUndone', async () => { /* s planned → click → onDone(s); done copy → click → onUndone */ })
test('rename saves the trimmed title on Enter', async () => { /* type '  Daily sync  {Enter}' after clear → onRename(s, 'Daily sync') once */ })
test('an empty title or Esc puts the old title back and saves nothing', async () => { /* clear + Tab → value 'Standup'; type 'x{Escape}' → 'Standup'; onRename not called */ })
test('a start time commits once, on leaving the box, and keeps the length', () => {
  const h = setup([s]); const box = screen.getByLabelText('Start: Standup')
  fireEvent.change(box, { target: { value: '10:15' } })
  expect(h.onReplan).not.toHaveBeenCalled()
  fireEvent.blur(box)
  expect(h.onReplan).toHaveBeenCalledExactlyOnceWith(s, ist(D, '10:15'), ist(D, '10:45'))
})
test('Esc in the start box puts the old time back', () => { /* change to 11:00, keyDown Escape, blur → value '09:00', onReplan not called */ })
test('a length commits on Enter; out of range puts the old one back', async () => {
  /* clear + '45{Enter}' → onReplan(s, ist(D,'09:00'), ist(D,'09:45')); clear + '3' + Tab → value 30, no second call */
})
test('+30 calls onPush, Skip calls onSkip, and a skipped row offers Unskip', async () => { /* … onUnskip on the skipped copy */ })
test('Remove asks first', async () => { /* confirm → false: no onRemove; → true: onRemove(s); confirm text 'Delete "Standup"?' */ })
test('done and skipped rows disable start, length and +30', () => { /* done copy + skipped copy: Start/Length/+30 disabled; done Skip disabled */ })
test('an empty day renders nothing, like the list', () => { /* setup([]) → queryByRole('list') is null */ })   // the list has no empty message (CODE: TodayView.tsx)
```

- [ ] **Step 2: Run** `npx vitest run src/ui/TaskTable.test.tsx src/domain/time.test.ts`. Expected: FAIL (`TaskTable` and `withLocalTime` missing).
- [ ] **Step 3: Implement**
  - `withLocalTime`.
  - `TaskTable`:
    - Local draft state per row for title, start and length.
    - Commit on blur or Enter; Esc reverts the draft.
    - A start commit calls `onReplan(t, withLocalTime(t.start, v), start + current length)`. A length commit calls `onReplan(t, t.start, start + v min)`.
    - Nothing is called when the committed value equals the saved one.
  - `.task-table` CSS:
    - one grid row per task;
    - below 560 px, wrap to two lines (title row, then controls) with no sideways scroll;
    - done and skipped rows dimmed.
- [ ] **Step 4: Run** the same command. Expected: all pass.
- [ ] **Step 5: Commit** `feat(ui): task table with inline done, rename, start, length, +30, skip and remove`

---

### Task 5: Wire the switch and table into Today and Tomorrow

**Files:**
- Modify: `src/ui/TodayView.tsx`. The switch goes above the tasks, the table renders in place of `m.ol`, and there are shared handlers.
- Test: `src/ui/TodayView.table.test.tsx` (new)

**Interfaces:**
- Consumes: `push`, the `undo`/`dropUndoFor` shape (Task 2), `readDayView`/`saveDayView`/`ViewSwitch` (Task 3), `TaskTable` (Task 4), `pushChain`/`describePush` (Task 1).
- Produces: shared handlers in `TodayView`, used by both `TaskRow` and `TaskTable`:
  - `markDone(t)`, `markUndone(t)`, `markSkipped(t)`, `unskip(t)`, `rename(t, title)`
  - `replan(t, start, end)`. It saves `{ ...t, start, end, originalEnd: end }`. Then `moved = pushChain(t, that, shown.tasks)`; it saves each moved task, and if any moved, sets the Undo with `describePush(t.title, end, moved, deltaMin)`.
  - `push(t)`
  - `remove(t)`. It is `dropUndoFor` plus `shown.remove`; the table confirms before calling it.

- [ ] **Step 1: Write the failing tests** (`localStorage.clear()` before each; seeded Standup 09:00–09:15 and Review 09:20–10:00; `NOW` 09:10; `const table = () => userEvent.click(screen.getByRole('button', { name: 'Table' }))`)

```ts
test('the switch shows on Today and Tomorrow, not in Summary or Setup', /* with settingsRepo + routineRepo; Summary and gear hide the View group */)
test('Table shows the day as a table, and the choice survives a reload', /* table → unmount → render again → checkbox 'Done: Standup' present */)
test('+30 in the table moves the chain, and Undo puts it all back', async () => {
  /* table; click '+30 min: Standup' → findByText('Standup: ends at 09:45. Moved Review by 30 min.');
     repo Review 09:50–10:30; click Undo → Review 09:20–10:00, Standup end 09:15 */
})
test('a later start time re-plans and pushes the chain', () => {
  /* change 'Start: Standup' to 09:30 + blur → Standup {start 09:30, end 09:45, originalEnd 09:45}; Review 09:50–10:30 */
})
test('moving a task earlier moves nothing else and re-sorts the rows', () => {
  /* 'Start: Review' → 08:30 + blur → rows ['Review','Standup']; Standup unchanged; no Undo button */
})
test('two +30s in a row move the chain twice', async () => {
  /* click '+30 min: Standup' twice → Review 10:20–11:00 */
})
test('Done and rename in the table save', async () => {
  /* tick 'Done: Standup' → status done + Undo shown; rename Review → 'Code review' saved */
})
```

- [ ] **Step 2: Run** `npx vitest run src/ui/TodayView.table.test.tsx`. Expected: FAIL (no View switch).
- [ ] **Step 3: Implement the wiring**
  - The switch shows when `!showSummary && !setupOpen`, after the banners and right above the tasks.
  - `const [dayView, setDayView] = useState(readDayView)`; on a change, save it as well.
  - Move the row handlers into the shared functions above, so the list and the table call the same ones.
- [ ] **Step 4: Run** `npm test`, then `npm run lint`, then `npm run build`. Expected: everything passes, with no lint warnings and a clean build.
- [ ] **Step 5: Commit** `feat(ui): List | Table on Today and Tomorrow, sharing one set of task actions`

---

## After the tasks
- **Whole-branch review:** a fresh reviewer on the most capable model. Its focus is the Review Focus list and the Undo/save ordering.
- **Before merge:** a manual check at 375 px and in dark mode, using the preview or the browser. Shubh's OK is needed to push, open a PR and merge.
- **After deploy:**
  - a live test in Chrome, one feature at a time, with screenshots;
  - check that moved tasks get fresh Teams nudge cards (a GUESS in the spec).
