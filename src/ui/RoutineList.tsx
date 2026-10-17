import { WEEKDAYS, type Routine } from '../domain/routine'
import { formatMinutes } from './neu/format'
import { Switch } from './neu/Switch'

export type AddState = 'on-today' | 'added' | undefined

interface Props {
  routines: Routine[]
  /** Per routine: already on today, just added, or neither. */
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
                  <div className="routine-chips" aria-label={`Days: ${r.days.join(', ')}`}>
                    {WEEKDAYS.map((d) => (
                      <span key={d} data-on={r.days.includes(d)} aria-hidden="true">
                        {SHORT[d]}
                      </span>
                    ))}
                  </div>
                </div>
                <Switch label="Active" checked={r.active} onChange={(on) => onToggleActive(r, on)} />
              </div>
              <div className="routine-actions">
                {state === 'on-today' ? (
                  <span className="muted">Already on today</span>
                ) : state === 'added' ? (
                  <span className="setup-saved">Added to today</span>
                ) : (
                  <button onClick={() => onAddToToday(r)}>Add to today</button>
                )}
                <button onClick={() => onEdit(r)}>Edit</button>
                <button onClick={() => onDelete(r)}>Delete</button>
              </div>
            </article>
          </li>
        )
      })}
    </ul>
  )
}
