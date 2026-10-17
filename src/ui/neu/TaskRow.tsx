import { useRef, useState, type KeyboardEvent } from 'react'
import { AnimatePresence, motion, type PanInfo } from 'motion/react'
import type { Task } from '../../domain/task'
import { formatLocalTime } from '../../domain/time'
import { CATEGORY_LABEL } from '../labels'
import { swipeAction, swipeTarget } from './swipe'

interface Props {
  task: Task
  /** The task running right now gets a pulsing outline. */
  isNow: boolean
  onDone: () => void
  onStarted: () => void
  onPlus15: () => void
  onSkip: () => void
  onEdit: () => void
  onDelete: () => void
}

const CATEGORY_ICON = { office: '💼', freelance: '✍️', youtube: '🎬' } as const

function minutes(task: Task): string {
  const m = Math.round((Date.parse(task.end) - Date.parse(task.start)) / 60_000)
  return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`
}

/**
 * One task on the timeline. Tap the circle to tick it done; tap the row to unfold
 * Started / +15 / Skip / Edit / Delete; swipe right to move it forward, left to skip.
 */
export function TaskRow({ task, isNow, onDone, onStarted, onPlus15, onSkip, onEdit, onDelete }: Props) {
  const [open, setOpen] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const rowRef = useRef<HTMLElement>(null)
  const planned = task.status === 'planned'

  function confirmDelete() {
    if (window.confirm(`Delete "${task.title}"?`)) onDelete()
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      setOpen(false)
      toggleRef.current?.focus()
    }
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    const direction = swipeAction(info.offset.x, info.offset.y, rowRef.current?.offsetWidth ?? 0)
    const target = direction && swipeTarget(task, direction)
    if (target === 'started') onStarted()
    if (target === 'done') onDone()
    if (target === 'skip') onSkip()
  }

  return (
    <motion.li layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
      <motion.article
        ref={rowRef}
        aria-label={task.title}
        className={['task-row', 'neu-raised', isNow && 'now'].filter(Boolean).join(' ')}
        data-category={task.category}
        data-status={task.status}
        onKeyDown={onKeyDown}
        drag={planned ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.4}
        onDragEnd={onDragEnd}
      >
        <div className="task-row-main">
          {planned ? (
            <button className="tick" aria-label="Done" onClick={onDone} />
          ) : (
            <span className="tick tick-done" aria-hidden="true">
              {task.status === 'done' ? '✓' : '–'}
            </span>
          )}
          <button
            ref={toggleRef}
            className="task-row-toggle"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <span className="task-row-title">
              <span aria-hidden="true">{CATEGORY_ICON[task.category]} </span>
              {task.status === 'done' && <span className="visually-hidden">✓ </span>}
              {task.title}
            </span>
            <span className="task-row-meta">
              {formatLocalTime(task.start)}–{formatLocalTime(task.end)} · <span className="tag">{CATEGORY_LABEL[task.category]}</span>
              {isNow && <span className="now-badge"> · Now</span>}
              {!planned && <span className="status"> · {task.status}</span>}
            </span>
          </button>
          <span className="task-row-length">{minutes(task)}</span>
        </div>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              className="task-row-actions"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              {planned && !task.actualStart && <button onClick={onStarted}>Started</button>}
              {planned && <button onClick={onPlus15}>+15 min</button>}
              {planned && <button onClick={onSkip}>Skip</button>}
              <button onClick={onEdit}>Edit</button>
              <button onClick={confirmDelete}>Delete</button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.article>
    </motion.li>
  )
}
