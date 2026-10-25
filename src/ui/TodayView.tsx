import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import { chainShiftMin, describePush, pushChain, pushTask } from '../domain/push'
import { pauses } from '../domain/fixed'
import type { Task } from '../domain/task'
import { formatLocalTime, tasksForDay } from '../domain/time'
import { findNoBreakRuns } from '../domain/validate'
import { notificationPermission, requestNotificationPermission, showOsNotification } from '../notify/notify'
import { startScheduler } from '../scheduler/startScheduler'
import type { Nudge } from '../scheduler/dueNudges'
import type { RoutineRepository } from '../storage/RoutineRepository'
import type { SettingsRepository } from '../storage/SettingsRepository'
import type { TaskRepository } from '../storage/TaskRepository'
import { NudgeBanner } from './NudgeBanner'
import { Fab } from './neu/Fab'
import { formatMinutes } from './neu/format'
import { MotionPrefs } from './neu/MotionPrefs'
import { NeuButton } from './neu/NeuButton'
import { NeuSurface } from './neu/NeuSurface'
import { ProgressRing } from './neu/ProgressRing'
import { Sheet } from './neu/Sheet'
import { TaskRow } from './neu/TaskRow'
import { UndoBar } from './neu/UndoBar'
import { dayTotals } from './neu/totals'
import { SetupView } from './SetupView'
import { SummaryView } from './SummaryView'
import { WeekView } from './WeekView'
import { TaskTable } from './TaskTable'
import { TaskForm } from './TaskForm'
import { useTasks } from './useTasks'
import { readDayView, saveDayView, type DayView } from './dayView'
import { ViewSwitch } from './ViewSwitch'

interface Props {
  repo: TaskRepository
  /** Today. */
  day: Date
  now?: () => Date
  /** Shown as "Sign in again" when the Microsoft sign-in has expired. */
  onSignInAgain?: () => void
  /** Running as a Teams tab: Teams cards nudge, so browser pop-up hints are hidden. */
  inTeams?: boolean
  /** Settings and routines for the Setup screen; without them there's no gear. */
  settingsRepo?: SettingsRepository
  routineRepo?: RoutineRepository
}

const dayTitle = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

/** Re-renders once a minute so the "now" marker moves along. */
function useMinuteTick() {
  const [, setTick] = useState(0)
  useEffect(() => {
    let every: ReturnType<typeof setInterval> | undefined
    // Wait for the next whole minute, then tick every minute, so "now" moves on time.
    const first = setTimeout(() => {
      setTick((t) => t + 1)
      every = setInterval(() => setTick((t) => t + 1), 60_000)
    }, 60_000 - (Date.now() % 60_000))
    return () => {
      clearTimeout(first)
      clearInterval(every)
    }
  }, [])
}

export function TodayView({ repo, day, now = () => new Date(), onSignInAgain, inTeams = false, settingsRepo, routineRepo }: Props) {
  const dayKey = day.toDateString()
  const tomorrow = useMemo(() => {
    const d = new Date(dayKey)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12)
  }, [dayKey])

  // Today's list always drives the nudges; the switch only changes which day you see and edit.
  const today = useTasks(repo, day)
  const next = useTasks(repo, tomorrow)
  const [viewTomorrow, setViewTomorrow] = useState(false)
  const shown = viewTomorrow ? next : today
  const shownDay = viewTomorrow ? tomorrow : day

  const [editing, setEditing] = useState<Task | null>(null)
  const [adding, setAdding] = useState(false)
  // A new task that failed to save waits in the Retry queue; a second Add would save it twice.
  const [addFailed, setAddFailed] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [showWeek, setShowWeek] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const [dayView, setDayView] = useState<DayView>(readDayView)
  // The + form's default length comes from Setup; 30 until the saved value arrives.
  const [defaultLengthMin, setDefaultLengthMin] = useState(30)
  useEffect(() => {
    let live = true
    settingsRepo?.get().then(
      (s) => live && setDefaultLengthMin(s.defaultLengthMin),
      () => {},
    )
    return () => {
      live = false
    }
  }, [settingsRepo])
  useMinuteTick()
  const [notice, setNotice] = useState<string | null>(null)
  // The last Done or Skip on a row, kept for a few seconds so a mis-tap can be taken back.
  const [undo, setUndo] = useState<{ taskIds: string[]; message: string; restore: () => void } | null>(null)
  /** Only after the first day switch does the list slide in; on first load it shows at once. */
  const [slide, setSlide] = useState(false)
  /** An Undo for a task that was then deleted or edited would save a stale or missing task. */
  const dropUndoFor = (id: string) => setUndo((u) => (u?.taskIds.includes(id) ? null : u))
  useEffect(() => {
    if (!undo) return
    const id = setTimeout(() => setUndo(null), 6_000)
    return () => clearTimeout(id)
  }, [undo])

  const [nudges, setNudges] = useState<Nudge[]>([])
  const [permission, setPermission] = useState(notificationPermission)
  // The scheduler reads tasks through a ref, so it always sees the latest list.
  const tasksRef = useRef(today.tasks)
  useLayoutEffect(() => {
    tasksRef.current = today.tasks
  }, [today.tasks])

  useEffect(
    () =>
      startScheduler({
        getTasks: () => tasksRef.current,
        onNudge: (n) => {
          showOsNotification(n)
          setNudges((prev) => [...prev, n])
        },
      }),
    [],
  )

  const stamp = () => now().toISOString()
  const todayTask = (id: string) => today.tasks.find((t) => t.id === id)

  /** +30: the task runs on and the touching chain behind it moves too; one Undo puts them all back. */
  function push(list: typeof today, task: Task): { newEnd: string; moved: Task[] } {
    const { updated, moved, deltaMin } = pushTask(task, list.tasks, now())
    const before = [task, ...list.tasks.filter((t) => moved.some((m) => m.id === t.id))]
    void list.save(updated)
    for (const t of moved) void list.save(t)
    setUndo({
      taskIds: before.map((t) => t.id),
      message: describePush(task.title, updated.end, moved, deltaMin),
      restore: () => before.forEach((t) => void list.save(t)),
    })
    return { newEnd: updated.end, moved }
  }

  // One set of task actions for the list and the table, so both behave the same.
  function markDone(task: Task) {
    const list = shown
    void list.save({ ...task, status: 'done', actualEnd: stamp() })
    setUndo({ taskIds: [task.id], message: `Marked done: ${task.title}`, restore: () => void list.save(task) })
  }

  /** Pin or unpin fixed time; one Undo puts it back. */
  function toggleFixed(task: Task) {
    void shown.save({ ...task, fixed: !task.fixed })
    setUndo({ taskIds: [task.id], message: `${task.fixed ? 'Made flexible' : 'Marked fixed'}: ${task.title}`, restore: () => void shown.save(task) })
  }

  function markSkipped(task: Task) {
    const list = shown
    void list.save({ ...task, status: 'skipped' })
    setUndo({ taskIds: [task.id], message: `Skipped: ${task.title}`, restore: () => void list.save(task) })
  }

  /** A change you made yourself: an Undo that covers this task would now overwrite it, so it goes. */
  function edit(list: typeof today, task: Task) {
    dropUndoFor(task.id)
    void list.save(task)
  }

  /** Back to planned: an unticked Done (its actual end goes) or an Unskip. */
  function reopen(task: Task) {
    edit(shown, { ...task, status: 'planned', actualEnd: undefined })
  }

  function rename(task: Task, title: string) {
    edit(shown, { ...task, title })
  }

  /** A new start or length is a re-plan (originalEnd follows); a later end pushes the chain like +30. */
  function replan(task: Task, start: string, end: string) {
    const list = shown
    const updated = { ...task, start, end, originalEnd: end }
    const moved = pushChain(task, updated, list.tasks)
    void list.save(updated)
    for (const t of moved) void list.save(t)
    if (!moved.length) return dropUndoFor(task.id)
    const before = [task, ...list.tasks.filter((t) => moved.some((m) => m.id === t.id))]
    setUndo({
      taskIds: before.map((t) => t.id),
      message: describePush(task.title, end, moved, chainShiftMin(task, updated)),
      restore: () => before.forEach((t) => void list.save(t)),
    })
  }

  function remove(task: Task) {
    dropUndoFor(task.id)
    void shown.remove(task.id)
  }
  const clearNudgesFor = (id: string) => setNudges((prev) => prev.filter((n) => n.task.id !== id))
  // A nudge only stays while its task is still planned: Done, Skip or Delete anywhere clears it.
  // It shows the latest copy of its task, so an edit or +15 updates the text.
  const liveNudges = nudges.flatMap((n) => {
    const task = todayTask(n.task.id)
    return task?.status === 'planned' ? [{ ...n, task }] : []
  })
  const others = editing ? shown.tasks.filter((t) => t.id !== editing.id) : shown.tasks
  const error = today.error ?? next.error
  const needsSignIn = today.needsSignIn || next.needsSignIn

  function switchDay(toTomorrow: boolean) {
    setViewTomorrow(toTomorrow)
    setShowSummary(false)
    setShowWeek(false)
    setUndo(null)
    setSlide(true)
    setEditing(null)
    setAdding(false)
    setAddFailed(false)
    setNotice(null)
  }

  function closeSheet() {
    setAdding(false)
    setEditing(null)
    setAddFailed(false)
  }

  // Retry saved the waiting new task (the create count moved): the sheet's job is done.
  const [seenCreated, setSeenCreated] = useState(shown.createdCount)
  if (shown.createdCount !== seenCreated) {
    setSeenCreated(shown.createdCount)
    if (addFailed) {
      setAddFailed(false)
      setAdding(false)
    }
  }

  const nowMs = now().getTime()
  const isNow = (t: Task) =>
    !viewTomorrow && t.status === 'planned' && Date.parse(t.start) <= nowMs && nowMs < Date.parse(t.end)
  const doneCount = shown.tasks.filter((t) => t.status === 'done').length
  const minutes = dayTotals(shown.tasks)
  const sheetOpen = adding || editing !== null

  const errorBanner = error && (
    <div className="banner banner-error" role="alert">
      {error}{' '}
      {needsSignIn && onSignInAgain && (
        <button className="primary" onClick={onSignInAgain}>
          Sign in again
        </button>
      )}{' '}
      <button
        onClick={() => {
          today.retry()
          next.retry()
        }}
      >
        Retry
      </button>
    </div>
  )

  return (
    <MotionPrefs>
    <main className="today">
      <header className="today-header">
        <div>
          <h1>{viewTomorrow ? 'Tomorrow' : 'Today'}</h1>
          <p className="muted">{dayTitle.format(shownDay)}</p>
        </div>
        <div className="header-actions">
          {!viewTomorrow && <ProgressRing done={doneCount} total={shown.tasks.filter((t) => t.status !== 'skipped').length} />}
          {settingsRepo && routineRepo && (
            <NeuButton
              className="gear"
              aria-label="Setup"
              pressed={setupOpen}
              onClick={() => {
                // Fresh list, so tasks the Morning flow made since the app opened count as already on today.
                if (!setupOpen) void today.reload()
                setSetupOpen((o) => !o)
              }}
            >
              <span aria-hidden="true">⚙</span>
            </NeuButton>
          )}
        </div>
      </header>

      {!setupOpen && (
      <NeuSurface variant="inset" className="day-switch">
        <div role="group" aria-label="View">
          <NeuButton pressed={!viewTomorrow && !showSummary && !showWeek} onClick={() => switchDay(false)}>
            {!viewTomorrow && !showSummary && !showWeek && <m.span layoutId="day-pill" className="day-pill" aria-hidden="true" />}
            Today
          </NeuButton>
          <NeuButton pressed={viewTomorrow && !showSummary && !showWeek} onClick={() => switchDay(true)}>
            {(viewTomorrow && !showSummary && !showWeek) && <m.span layoutId="day-pill" className="day-pill" aria-hidden="true" />}
            Tomorrow
          </NeuButton>
          <NeuButton
            pressed={showSummary}
            onClick={() => {
              setShowSummary(true)
              setShowWeek(false)
            }}
          >
            {showSummary && <m.span layoutId="day-pill" className="day-pill" aria-hidden="true" />}
            Summary
          </NeuButton>
          <NeuButton
            pressed={showWeek}
            onClick={() => {
              setShowWeek(true)
              setShowSummary(false)
            }}
          >
            {showWeek && <m.span layoutId="day-pill" className="day-pill" aria-hidden="true" />}
            Week
          </NeuButton>
        </div>
      </NeuSurface>
      )}

      {!viewTomorrow && !showSummary && !showWeek && !setupOpen && (
        <NeuSurface variant="inset" className="focus-strip">
          <span>Focus today</span>
          <strong>
            {formatMinutes(minutes.done)} / {formatMinutes(minutes.planned)}
          </strong>
        </NeuSurface>
      )}

      {!sheetOpen && errorBanner}

      <NudgeBanner
        nudges={liveNudges}
        permission={permission}
        askForNotifications={!inTeams}
        onStarted={(id) => {
          const t = todayTask(id)
          if (t) edit(today, { ...t, actualStart: stamp() })
          clearNudgesFor(id)
        }}
        onDone={(id) => {
          const t = todayTask(id)
          if (t) edit(today, { ...t, status: 'done', actualEnd: stamp() })
          clearNudgesFor(id)
        }}
        onSkip={(id) => {
          const t = todayTask(id)
          if (t) edit(today, { ...t, status: 'skipped' })
          clearNudgesFor(id)
        }}
        onExtend={(id) => {
          const t = todayTask(id)
          return t ? push(today, t) : { newEnd: '', moved: [] }
        }}
        onDismiss={(key) => setNudges((prev) => prev.filter((n) => n.key !== key))}
        onEnableNotifications={async () => setPermission(await requestNotificationPermission())}
      />

      {notice && <div className="banner">{notice}</div>}

      {findNoBreakRuns(shown.tasks).map((run) => (
        <div key={run.fromUtc} className="banner banner-warning pill">
          3h+ without a break: {formatLocalTime(run.fromUtc)}–{formatLocalTime(run.toUtc)}
        </div>
      ))}

      <Sheet open={sheetOpen} onClose={closeSheet} title={editing ? 'Edit task' : 'New task'}>
        {errorBanner}
        {addFailed && <p className="muted">This task is waiting to be saved. Press Retry to save it.</p>}
        <TaskForm
          key={`${viewTomorrow ? 'tomorrow' : 'today'}-${editing ? `edit-${editing.id}` : `new-${shown.createdCount}`}`}
          day={shownDay}
          others={others}
          initial={editing ?? undefined}
          defaultLengthMin={defaultLengthMin}
          onSubmit={async (draft) => {
            if (!editing) {
              if (addFailed) return false
              setNotice(null)
              const ok = await shown.add(draft)
              if (!ok) setAddFailed(true)
              const start = new Date(draft.start)
              if (ok && tasksForDay([{ ...draft, id: '', originalEnd: draft.end, status: 'planned' }], shownDay).length === 0) {
                setNotice(`Saved for ${dayTitle.format(start)}`)
                if (start.toDateString() === dayKey) void today.reload()
                if (start.toDateString() === tomorrow.toDateString()) void next.reload()
              }
              if (ok) setAdding(false)
              return ok
            }
            // Start from the latest copy: a nudge may have changed the task while the form was open.
            const current = shown.tasks.find((t) => t.id === editing.id) ?? editing
            // Moving the times is a re-plan, so originalEnd follows; any other edit keeps it (and any +15 overrun).
            const moved = Date.parse(draft.start) !== Date.parse(current.start) || Date.parse(draft.end) !== Date.parse(current.end)
            const ok = await shown.save({ ...current, ...draft, originalEnd: moved ? draft.end : current.originalEnd })
            if (ok) {
                dropUndoFor(editing.id)
                setEditing(null)
              }
            return ok
          }}
          onCancel={closeSheet}
        />
      </Sheet>

      {!showSummary && !showWeek && !setupOpen && (
        <ViewSwitch
          value={dayView}
          onChange={(view) => {
            setDayView(view)
            saveDayView(view)
          }}
        />
      )}

      {setupOpen && settingsRepo && routineRepo ? (
        <SetupView
          settingsRepo={settingsRepo}
          routineRepo={routineRepo}
          day={day}
          todayTasks={today.tasks}
          addToToday={(draft) => today.add(draft)}
          onBack={() => setSetupOpen(false)}
          onSettingsSaved={(s) => setDefaultLengthMin(s.defaultLengthMin)}
        />
      ) : showSummary ? (
        <SummaryView tasks={shown.tasks} />
      ) : showWeek ? (
        <WeekView
          repo={repo}
          now={now()}
          live={[
            { day, tasks: today.tasks },
            { day: tomorrow, tasks: next.tasks },
          ]}
        />
      ) : dayView === 'table' ? (
        <m.div
          key={viewTomorrow ? 'tomorrow-table' : 'today-table'}
          initial={slide ? { opacity: 0, x: viewTomorrow ? 32 : -32 } : false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <TaskTable
            tasks={shown.tasks}
            isNow={isNow}
            onDone={markDone}
            onUndone={reopen}
            onSkip={markSkipped}
            onUnskip={reopen}
            onRename={rename}
            onReplan={replan}
            onPush={(task) => void push(shown, task)}
            onRemove={remove}
            onToggleFixed={toggleFixed}
          />
        </m.div>
      ) : (
        <m.ol
          className="timeline"
          key={viewTomorrow ? 'tomorrow' : 'today'}
          initial={slide ? { opacity: 0, x: viewTomorrow ? 32 : -32 } : false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <AnimatePresence initial={false}>
            {shown.tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                isNow={isNow(task)}
                pauses={pauses(task, shown.tasks)}
                onStarted={() => edit(shown, { ...task, actualStart: stamp() })}
                onDone={() => markDone(task)}
                onPush={() => void push(shown, task)}
                onSkip={() => markSkipped(task)}
                onEdit={() => setEditing(task)}
                onDelete={() => remove(task)}
              />
            ))}
          </AnimatePresence>
        </m.ol>
      )}

      <UndoBar
        message={undo?.message ?? null}
        onUndo={() => {
          undo?.restore()
          setUndo(null)
        }}
      />
      {!setupOpen && <Fab aria-label="New task" onClick={() => setAdding(true)} />}
    </main>
    </MotionPrefs>
  )
}
