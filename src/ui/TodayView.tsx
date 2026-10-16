import { useState } from 'react'
import type { Task } from '../domain/task'
import { formatLocalTime } from '../domain/time'
import { findNoBreakRuns } from '../domain/validate'
import type { TaskRepository } from '../storage/TaskRepository'
import { SummaryView } from './SummaryView'
import { TaskCard } from './TaskCard'
import { TaskForm } from './TaskForm'
import { useTasks } from './useTasks'

interface Props {
  repo: TaskRepository
  day: Date
  now?: () => Date
}

const dayTitle = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

export function TodayView({ repo, day, now = () => new Date() }: Props) {
  const { tasks, error, retry, add, save, remove, createdCount } = useTasks(repo, day)
  const [editing, setEditing] = useState<Task | null>(null)
  const [showSummary, setShowSummary] = useState(false)

  const stamp = () => now().toISOString()
  const others = editing ? tasks.filter((t) => t.id !== editing.id) : tasks

  return (
    <main className="today">
      <header className="today-header">
        <div>
          <h1>Today</h1>
          <p className="muted">{dayTitle.format(day)}</p>
        </div>
        <button onClick={() => setShowSummary((s) => !s)} aria-pressed={showSummary}>
          Summary
        </button>
      </header>

      {error && (
        <div className="banner banner-error" role="alert">
          {error} <button onClick={retry}>Retry</button>
        </div>
      )}

      {findNoBreakRuns(tasks).map((run) => (
        <div key={run.fromUtc} className="banner banner-warning">
          3h+ without a break: {formatLocalTime(run.fromUtc)}–{formatLocalTime(run.toUtc)}
        </div>
      ))}

      <TaskForm
        key={editing ? `edit-${editing.id}` : `new-${createdCount}`}
        day={day}
        others={others}
        initial={editing ?? undefined}
        onSubmit={async (draft) => {
          if (!editing) return add(draft)
          // Re-planning resets originalEnd; only +15 keeps it.
          const ok = await save({ ...editing, ...draft, originalEnd: draft.end })
          if (ok) setEditing(null)
          return ok
        }}
        onCancel={editing ? () => setEditing(null) : undefined}
      />

      <ol className="timeline">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onStarted={() => save({ ...task, actualStart: stamp() })}
            onDone={() => save({ ...task, status: 'done', actualEnd: stamp() })}
            onSkip={() => save({ ...task, status: 'skipped' })}
            onEdit={() => setEditing(task)}
            onDelete={() => remove(task.id)}
          />
        ))}
      </ol>

      {showSummary && <SummaryView tasks={tasks} />}
    </main>
  )
}
