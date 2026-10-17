import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'motion/react'
import { extendTask } from '../domain/extend'
import { summarize } from '../domain/summary'
import type { Task } from '../domain/task'
import { formatLocalTime, tasksForDay } from '../domain/time'
import { findNoBreakRuns } from '../domain/validate'
import { notificationPermission, requestNotificationPermission, showOsNotification } from '../notify/notify'
import { startScheduler } from '../scheduler/startScheduler'
import type { Nudge } from '../scheduler/dueNudges'
import type { TaskRepository } from '../storage/TaskRepository'
import { NudgeBanner } from './NudgeBanner'
import { Fab } from './neu/Fab'
import { formatMinutes } from './neu/format'
import { NeuButton } from './neu/NeuButton'
import { NeuSurface } from './neu/NeuSurface'
import { ProgressRing } from './neu/ProgressRing'
import { Sheet } from './neu/Sheet'
import { TaskRow } from './neu/TaskRow'
import { SummaryView } from './SummaryView'
import { TaskForm } from './TaskForm'
import { useTasks } from './useTasks'

interface Props {
  repo: TaskRepository
  /** Today. */
  day: Date
  now?: () => Date
  /** Shown as "Sign in again" when the Microsoft sign-in has expired. */
  onSignInAgain?: () => void
}

const dayTitle = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

/**
 * Minutes done so far against minutes planned (skipped tasks don't count).
 * A done task counts its real time only when Started was pressed; ticked late
 * without it, the planned length is the honest guess.
 */
function focus(tasks: Task[]): { done: number; planned: number } {
  const { perTask } = summarize(tasks)
  const started = new Set(tasks.filter((t) => t.actualStart).map((t) => t.id))
  return {
    done: perTask.reduce(
      (sum, t) => sum + (t.status === 'done' ? (started.has(t.id) ? (t.actualMin ?? t.plannedMin) : t.plannedMin) : 0),
      0,
    ),
    planned: perTask.reduce((sum, t) => sum + (t.status === 'skipped' ? 0 : t.plannedMin), 0),
  }
}

/** Re-renders once a minute so the "now" marker moves along. */
function useMinuteTick() {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])
}

export function TodayView({ repo, day, now = () => new Date(), onSignInAgain }: Props) {
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
  const [showSummary, setShowSummary] = useState(false)
  useMinuteTick()
  const [notice, setNotice] = useState<string | null>(null)

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
    setEditing(null)
    setAdding(false)
    setNotice(null)
  }

  function closeSheet() {
    setAdding(false)
    setEditing(null)
  }

  const nowMs = now().getTime()
  const isNow = (t: Task) =>
    !viewTomorrow && t.status === 'planned' && Date.parse(t.start) <= nowMs && nowMs < Date.parse(t.end)
  const doneCount = shown.tasks.filter((t) => t.status === 'done').length
  const minutes = focus(shown.tasks)

  return (
    <main className="today">
      <header className="today-header">
        <div>
          <h1>{viewTomorrow ? 'Tomorrow' : 'Today'}</h1>
          <p className="muted">{dayTitle.format(shownDay)}</p>
        </div>
        {!viewTomorrow && <ProgressRing done={doneCount} total={shown.tasks.length} />}
      </header>

      <NeuSurface variant="inset" className="day-switch">
        <div role="group" aria-label="View">
          <NeuButton pressed={!viewTomorrow && !showSummary} onClick={() => switchDay(false)}>
            Today
          </NeuButton>
          <NeuButton pressed={viewTomorrow && !showSummary} onClick={() => switchDay(true)}>
            Tomorrow
          </NeuButton>
          <NeuButton pressed={showSummary} onClick={() => setShowSummary(true)}>
            Summary
          </NeuButton>
        </div>
      </NeuSurface>

      {!viewTomorrow && !showSummary && (
        <NeuSurface variant="inset" className="focus-strip">
          <span>Focus today</span>
          <strong>
            {formatMinutes(minutes.done)} / {formatMinutes(minutes.planned)}
          </strong>
        </NeuSurface>
      )}

      {error && (
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
      )}

      <NudgeBanner
        nudges={liveNudges}
        permission={permission}
        onStarted={(id) => {
          const t = todayTask(id)
          if (t) void today.save({ ...t, actualStart: stamp() })
          clearNudgesFor(id)
        }}
        onDone={(id) => {
          const t = todayTask(id)
          if (t) void today.save({ ...t, status: 'done', actualEnd: stamp() })
          clearNudgesFor(id)
        }}
        onSkip={(id) => {
          const t = todayTask(id)
          if (t) void today.save({ ...t, status: 'skipped' })
          clearNudgesFor(id)
        }}
        onExtend={(id) => {
          const t = todayTask(id)
          if (!t) return { newEnd: '', affected: [] }
          const { updated, affected } = extendTask(t, 15, today.tasks, now())
          void today.save(updated)
          return { newEnd: updated.end, affected }
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

      <Sheet open={adding || editing !== null} onClose={closeSheet} title={editing ? 'Edit task' : 'New task'}>
        <TaskForm
          key={`${viewTomorrow ? 'tomorrow' : 'today'}-${editing ? `edit-${editing.id}` : `new-${shown.createdCount}`}`}
          day={shownDay}
          others={others}
          initial={editing ?? undefined}
          onSubmit={async (draft) => {
            if (!editing) {
              setNotice(null)
              const ok = await shown.add(draft)
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
            if (ok) setEditing(null)
            return ok
          }}
          onCancel={closeSheet}
        />
      </Sheet>

      {showSummary ? (
        <SummaryView tasks={shown.tasks} />
      ) : (
        <ol className="timeline">
          <AnimatePresence initial={false}>
            {shown.tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                isNow={isNow(task)}
                onStarted={() => void shown.save({ ...task, actualStart: stamp() })}
                onDone={() => void shown.save({ ...task, status: 'done', actualEnd: stamp() })}
                onPlus15={() => void shown.save(extendTask(task, 15, shown.tasks, now()).updated)}
                onSkip={() => void shown.save({ ...task, status: 'skipped' })}
                onEdit={() => setEditing(task)}
                onDelete={() => void shown.remove(task.id)}
              />
            ))}
          </AnimatePresence>
        </ol>
      )}

      <Fab aria-label="New task" onClick={() => setAdding(true)} />
    </main>
  )
}
