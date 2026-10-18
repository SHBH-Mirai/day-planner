import { useState } from 'react'
import { AnimatePresence, m } from 'motion/react'
import type { Task } from '../domain/task'
import { formatLocalTime } from '../domain/time'
import { nudgeText, type PermissionState } from '../notify/notify'
import type { Nudge } from '../scheduler/dueNudges'

interface ExtendResult {
  newEnd: string
  /** The later tasks the push moved along with it. */
  moved: Task[]
}

interface Props {
  nudges: Nudge[]
  permission: PermissionState
  onStarted: (taskId: string) => void
  onDone: (taskId: string) => void
  onSkip: (taskId: string) => void
  onExtend: (taskId: string) => ExtendResult
  onDismiss: (key: string) => void
  onEnableNotifications: () => void
  /** False inside Teams: pop-ups can't be enabled there, and Teams cards do the nudging. */
  askForNotifications?: boolean
}

function extendMessage({ newEnd, moved }: ExtendResult): string {
  const rest = moved.length ? `Moved: ${moved.map((t) => t.title).join(', ')}` : 'Nothing else moves.'
  return `Extended to ${formatLocalTime(newEnd)}. ${rest}`
}

export function NudgeBanner({
  nudges,
  permission,
  onStarted,
  onDone,
  onSkip,
  onExtend,
  onDismiss,
  onEnableNotifications,
  askForNotifications = true,
}: Props) {
  const [extended, setExtended] = useState<Record<string, string>>({})

  return (
    <div className="nudges">
      {askForNotifications && permission === 'default' && (
        <div className="banner">
          Get a pop-up at each task's start and end.{' '}
          <button onClick={onEnableNotifications}>Enable notifications</button>
        </div>
      )}
      {askForNotifications && permission === 'denied' && (
        <div className="banner banner-warning">
          Notifications are blocked for this site, so nudges only show here on the page. Allow them in the browser's site settings.
        </div>
      )}

      <AnimatePresence initial={false}>
      {nudges.map((n) => {
        const id = n.task.id
        const due = n.kind === 'start' ? n.task.start : n.task.end
        return (
          <m.div
            key={n.key}
            className={`nudge nudge-${n.kind} neu-raised`}
            role="status"
            data-category={n.task.category}
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
          >
            <strong>{nudgeText(n)}</strong>
            {n.missed && <span className="muted"> missed at {formatLocalTime(due)}</span>}
            <div className="nudge-actions">
              {extended[n.key] ? (
                <span>{extended[n.key]}</span>
              ) : n.kind === 'start' ? (
                <button className="primary" onClick={() => onStarted(id)}>
                  Started
                </button>
              ) : (
                <>
                  <button className="primary" onClick={() => onDone(id)}>
                    Done
                  </button>
                  <button onClick={() => setExtended((e) => ({ ...e, [n.key]: extendMessage(onExtend(id)) }))}>
                    +30 min
                  </button>
                  <button onClick={() => onSkip(id)}>Skip</button>
                </>
              )}
              <button onClick={() => onDismiss(n.key)}>Dismiss</button>
            </div>
          </m.div>
        )
      })}
      </AnimatePresence>
    </div>
  )
}
