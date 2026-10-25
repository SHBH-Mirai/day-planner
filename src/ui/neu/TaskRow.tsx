import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { AnimatePresence, m, type PanInfo } from 'motion/react'
import type { Task } from '../../domain/task'
import { formatLocalTime } from '../../domain/time'
import { CATEGORY_ICON, CATEGORY_LABEL } from '../labels'
import { ConfirmButton } from './ConfirmButton'
import { formatMinutes } from './format'
import { swipeAction, swipeTarget } from './swipe'
import type { Pause } from '../../domain/fixed'

interface Props {
  task: Task
  /** The task running right now gets a pulsing outline. */
  isNow: boolean
  onDone: () => void
  onStarted: () => void
  onPush: () => void
  onSkip: () => void
  onEdit: () => void
  onDelete: () => void
  /** Fixed tasks (calls, meetings) inside this one: shown, and left out of its length. */
  pauses?: Pause[]
}

function minutes(task: Task, pauses: Pause[]): string {
  const paused = pauses.reduce((ms, p) => ms + Date.parse(p.to) - Date.parse(p.from), 0)
  return formatMinutes(Math.round((Date.parse(task.end) - Date.parse(task.start) - paused) / 60_000))
}

/**
 * One task on the timeline. Tap the circle to tick it done; tap the row to unfold
 * Started / +30 / Skip / Edit / Delete; swipe right to move it forward, left to skip.
 */
export function TaskRow({ task, isNow, onDone, onStarted, onPush, onSkip, onEdit, onDelete, pauses = [] }: Props) {
  const [open, setOpen] = useState(false)
  const titleId = useId()
  const toggleRef = useRef<HTMLButtonElement>(null)
  // A mouse swipe ends in a click; this keeps that click from also unfolding the row.
  const dragged = useRef(false)
  /** Runs an action, then puts focus back on the row (the pressed button may disappear). */
  const thenFocus = (action: () => void) => () => {
    action()
    toggleRef.current?.focus()
  }
  const rowRef = useRef<HTMLElement>(null)
  const planned = task.status === 'planned'

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
    <m.li layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
      <m.article
        ref={rowRef}
        aria-label={task.title}
        className={['task-row', 'neu-raised', isNow && 'now'].filter(Boolean).join(' ')}
        data-category={task.category}
        data-status={task.status}
        onKeyDown={onKeyDown}
        drag={planned ? 'x' : false}
        onDragStart={() => (dragged.current = true)}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.4}
        onDragEnd={onDragEnd}
      >
        <div className="task-row-main">
          {planned ? (
            <button className="tick" aria-label="Done" aria-describedby={titleId} onClick={thenFocus(onDone)} />
          ) : (
            <span className="tick tick-done" aria-hidden="true">
              {task.status === 'done' ? '✓' : '–'}
            </span>
          )}
          <button
            ref={toggleRef}
            className="task-row-toggle"
            aria-expanded={open}
            onPointerDown={() => (dragged.current = false)}
            onClick={(e) => {
              // A keyboard press (detail 0) is never the tail of a swipe.
              if (dragged.current && e.detail !== 0) {
                dragged.current = false
                return
              }
              setOpen((o) => !o)
            }}
          >
            <span className="task-row-title" id={titleId}>
              <span aria-hidden="true">{CATEGORY_ICON[task.category]} </span>
              {task.status === 'done' && <span className="visually-hidden">✓ </span>}
              {task.title}
            </span>
            <span className="task-row-meta">
              <span className="task-row-time">
                {formatLocalTime(task.start)}–{formatLocalTime(task.end)}
              </span>
              {task.fixed && (
                <span className="fixed-pin" role="img" aria-label="Fixed time" title="Fixed time">
                  {' '}📌
                </span>
              )}{' '}
              · <span className="tag">{CATEGORY_LABEL[task.category]}</span>
              {isNow && <span className="now-badge"> · Now</span>}
              {!planned && <span className="status"> · {task.status}</span>}
            </span>
            {pauses.length > 0 && (
              <span className="task-row-pause">
                {pauses.map((p) => `Paused ${formatLocalTime(p.from)}–${formatLocalTime(p.to)} · ${p.title}`).join(', ')}
              </span>
            )}
          </button>
          <span className="task-row-length">{minutes(task, pauses)}</span>
        </div>
        <AnimatePresence initial={false}>
          {open && (
            <m.div
              className="task-row-actions"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              {task.description && <p className="task-row-description">{task.description}</p>}
              {planned && !task.actualStart && <button onClick={thenFocus(onStarted)}>Started</button>}
              {planned && <button onClick={thenFocus(onPush)}>+30 min</button>}
              {planned && <button onClick={thenFocus(onSkip)}>Skip</button>}
              <button onClick={onEdit}>Edit</button>
              <ConfirmButton label="Delete" question={`Delete "${task.title}"?`} onConfirm={onDelete} />
            </m.div>
          )}
        </AnimatePresence>
      </m.article>
    </m.li>
  )
}
