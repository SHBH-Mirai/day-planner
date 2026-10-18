import { useState, type KeyboardEvent } from 'react'
import { AnimatePresence, m } from 'motion/react'
import type { Task } from '../domain/task'
import { formatLocalTime, minutesBetween, withLocalTime } from '../domain/time'
import { CATEGORY_LABEL } from './labels'
import { NeuSurface } from './neu/NeuSurface'

export interface TaskTableProps {
  tasks: Task[]
  isNow: (t: Task) => boolean
  onDone: (t: Task) => void
  onUndone: (t: Task) => void
  onSkip: (t: Task) => void
  onUnskip: (t: Task) => void
  onRename: (t: Task, title: string) => void
  /** A new start or length: `start` and `end` are UTC ISO strings. */
  onReplan: (t: Task, start: string, end: string) => void
  onPush: (t: Task) => void
  onRemove: (t: Task) => void
}

const MIN_LENGTH = 5
const MAX_LENGTH = 720
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/
const plusMinutes = (iso: string, min: number) => new Date(Date.parse(iso) + min * 60_000).toISOString()

/**
 * The whole day in one card: every task with its controls in reach. It only reports what you
 * asked for; TodayView saves. Typed values commit on Enter or when you leave the box, Esc puts
 * the saved value back.
 */
export function TaskTable({ tasks, ...rowProps }: TaskTableProps) {
  if (tasks.length === 0) return null
  const sorted = [...tasks].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
  return (
    <NeuSurface className="task-table">
      <ol>
        <AnimatePresence initial={false}>
          {sorted.map((task) => (
            <TableRow key={task.id} task={task} {...rowProps} />
          ))}
        </AnimatePresence>
      </ol>
    </NeuSurface>
  )
}

function TableRow({ task, isNow, onDone, onUndone, onSkip, onUnskip, onRename, onReplan, onPush, onRemove }: Omit<TaskTableProps, 'tasks'> & { task: Task }) {
  const savedStart = formatLocalTime(task.start)
  const savedLength = minutesBetween(task.start, task.end)

  const [seen, setSeen] = useState(task)
  const [title, setTitle] = useState(task.title)
  const [start, setStart] = useState(savedStart)
  const [length, setLength] = useState(String(savedLength))
  // A save or a push elsewhere changed this task: show its new values.
  if (seen !== task) {
    setSeen(task)
    setTitle(task.title)
    setStart(savedStart)
    setLength(String(savedLength))
  }

  const closed = task.status !== 'planned'
  const name = task.title

  function commitTitle() {
    const next = title.trim()
    if (!next) return setTitle(task.title)
    setTitle(next)
    if (next !== task.title) onRename(task, next)
  }

  function commitStart() {
    if (!HH_MM.test(start)) return setStart(savedStart)
    if (start === savedStart) return
    const nextStart = withLocalTime(task.start, start)
    onReplan(task, nextStart, plusMinutes(nextStart, savedLength))
  }

  function commitLength() {
    const n = Number(length)
    if (!Number.isInteger(n) || n < MIN_LENGTH || n > MAX_LENGTH) return setLength(String(savedLength))
    if (n !== savedLength) onReplan(task, task.start, plusMinutes(task.start, n))
  }

  /** Enter leaves the box (which commits); Esc puts the saved value back first. */
  const keys = (reset: () => void) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur()
    if (e.key === 'Escape') reset()
  }

  return (
    // The list item animates (motion leaves an inline opacity); the article inside carries the
    // status, so the CSS that dims done and skipped rows isn't overridden.
    <m.li layout className="table-item" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <article
      aria-label={name}
      className={`table-row${isNow(task) ? ' now' : ''}`}
      data-status={task.status}
      data-category={task.category}
    >
      <input
        type="checkbox"
        aria-label={`Done: ${name}`}
        checked={task.status === 'done'}
        onChange={() => (task.status === 'done' ? onUndone(task) : onDone(task))}
      />
      <div className="table-title">
        <input
          type="text"
          aria-label={`Title: ${name}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={keys(() => setTitle(task.title))}
        />
        <span className="table-meta">
          {CATEGORY_LABEL[task.category]} · ends {formatLocalTime(task.end)}
        </span>
      </div>
      <input
        type="time"
        aria-label={`Start: ${name}`}
        value={start}
        disabled={closed}
        onChange={(e) => setStart(e.target.value)}
        onBlur={commitStart}
        onKeyDown={keys(() => setStart(savedStart))}
      />
      <input
        type="number"
        aria-label={`Length (min): ${name}`}
        min={MIN_LENGTH}
        max={MAX_LENGTH}
        step={5}
        inputMode="numeric"
        value={length}
        disabled={closed}
        onChange={(e) => setLength(e.target.value)}
        onBlur={commitLength}
        onKeyDown={keys(() => setLength(String(savedLength)))}
      />
      <div className="table-actions">
        <button aria-label={`+30 min: ${name}`} disabled={closed} onClick={() => onPush(task)}>
          +30
        </button>
        {task.status === 'skipped' ? (
          <button aria-label={`Unskip: ${name}`} onClick={() => onUnskip(task)}>
            Unskip
          </button>
        ) : (
          <button aria-label={`Skip: ${name}`} disabled={task.status === 'done'} onClick={() => onSkip(task)}>
            Skip
          </button>
        )}
        <button aria-label={`Remove: ${name}`} onClick={() => window.confirm(`Delete "${name}"?`) && onRemove(task)}>
          ✕
        </button>
      </div>
    </article>
    </m.li>
  )
}
