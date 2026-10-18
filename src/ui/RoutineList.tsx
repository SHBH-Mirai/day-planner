import { WEEKDAYS, type Routine } from '../domain/routine'
import { ConfirmButton } from './neu/ConfirmButton'
import { formatMinutes } from './neu/format'
import { Switch } from './neu/Switch'

/** Where a routine stands for "Add to today". */
export type AddState = 'invalid' | 'on-today' | 'adding' | 'added' | 'failed' | undefined

interface Props {
  routines: Routine[]
  /** Per routine: broken, already on today, being added, added, waiting for Retry, or free to add. */
  addState: (r: Routine) => AddState
  onToggleActive: (r: Routine, active: boolean) => void
  onAddToToday: (r: Routine) => void
  onEdit: (r: Routine) => void
  onDelete: (r: Routine) => void
}

const SHORT = { Mon: 'M', Tue: 'T', Wed: 'W', Thu: 'T', Fri: 'F', Sat: 'S', Sun: 'S' } as const

/** One row per routine: time, length, days, an Active switch and its actions. */
export function RoutineList({ routines, addState, onToggleActive, onAddToToday, onEdit, onDelete }: Props) {
  if (routines.length === 0) return <p className="muted">No routines yet. Add one, and the 06:00 Morning flow puts it on its days.</p>
  return (
    <ul className="routine-list">
      {routines.map((r) => {
        const state = addState(r)
        return (
          <li key={r.id}>
            <article className="routine-row neu-raised" aria-label={r.title} data-active={r.active}>
              <div className="routine-main">
                <div>
                  <div className="task-row-title">{r.title}</div>
                  <div className="task-row-meta">
                    {r.startTime} · {formatMinutes(r.durationMin)}
                  </div>
                  <div className="routine-chips" role="img" aria-label={`Days: ${r.days.join(', ')}`}>
                    {WEEKDAYS.map((d) => (
                      <span key={d} data-on={r.days.includes(d)} aria-hidden="true">
                        {SHORT[d]}
                      </span>
                    ))}
                  </div>
                </div>
                <Switch label={`Active: ${r.title}`} checked={r.active} onChange={(on) => onToggleActive(r, on)} />
              </div>
              <div className="routine-actions">
                {state === 'invalid' ? (
                  <span className="form-warnings">Needs fixing: open Edit</span>
                ) : state === 'on-today' ? (
                  <span className="muted">Already on today</span>
                ) : state === 'added' ? (
                  <span className="setup-saved">Added to today</span>
                ) : state === 'failed' ? (
                  <span className="form-warnings">Waiting to be saved: press Retry</span>
                ) : (
                  <button disabled={state === 'adding'} onClick={() => onAddToToday(r)}>
                    {state === 'adding' ? 'Adding…' : 'Add to today'}
                  </button>
                )}
                <button onClick={() => onEdit(r)}>Edit</button>
                <ConfirmButton
                  label="Delete"
                  question={`Delete "${r.title}"? It goes to the SharePoint recycle bin.`}
                  onConfirm={() => onDelete(r)}
                />
              </div>
            </article>
          </li>
        )
      })}
    </ul>
  )
}
