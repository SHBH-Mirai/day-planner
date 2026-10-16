import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { extendTask } from '../domain/extend'
import type { Task } from '../domain/task'
import { formatLocalTime, tasksForDay } from '../domain/time'
import { findNoBreakRuns } from '../domain/validate'
import { notificationPermission, requestNotificationPermission, showOsNotification } from '../notify/notify'
import { startScheduler } from '../scheduler/startScheduler'
import type { Nudge } from '../scheduler/dueNudges'
import type { TaskRepository } from '../storage/TaskRepository'
import { NudgeBanner } from './NudgeBanner'
import { SummaryView } from './SummaryView'
import { TaskCard } from './TaskCard'
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
  const [showSummary, setShowSummary] = useState(false)
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
    setEditing(null)
    setNotice(null)
  }

  return (
    <main className="today">
      <header className="today-header">
        <div>
          <h1>{viewTomorrow ? 'Tomorrow' : 'Today'}</h1>
          <p className="muted">{dayTitle.format(shownDay)}</p>
        </div>
        <div className="header-actions">
          <div className="day-switch" role="group" aria-label="Day">
            <button aria-pressed={!viewTomorrow} onClick={() => switchDay(false)}>
              Today
            </button>
            <button aria-pressed={viewTomorrow} onClick={() => switchDay(true)}>
              Tomorrow
            </button>
          </div>
          <button onClick={() => setShowSummary((s) => !s)} aria-pressed={showSummary}>
            Summary
          </button>
        </div>
      </header>

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
        <div key={run.fromUtc} className="banner banner-warning">
          3h+ without a break: {formatLocalTime(run.fromUtc)}–{formatLocalTime(run.toUtc)}
        </div>
      ))}

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
        onCancel={editing ? () => setEditing(null) : undefined}
      />

      <ol className="timeline">
        {shown.tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onStarted={() => shown.save({ ...task, actualStart: stamp() })}
            onDone={() => shown.save({ ...task, status: 'done', actualEnd: stamp() })}
            onSkip={() => shown.save({ ...task, status: 'skipped' })}
            onEdit={() => setEditing(task)}
            onDelete={() => shown.remove(task.id)}
          />
        ))}
      </ol>

      {showSummary && <SummaryView tasks={shown.tasks} />}
    </main>
  )
}
