import { useEffect, useState } from 'react'
import { isOnDay, routineToDraft, type Routine, type RoutineDraft } from '../domain/routine'
import type { Task, TaskDraft } from '../domain/task'
import type { RoutineRepository } from '../storage/RoutineRepository'
import type { Settings, SettingsRepository } from '../storage/SettingsRepository'
import { NeuSurface } from './neu/NeuSurface'
import { Sheet } from './neu/Sheet'
import { Switch } from './neu/Switch'
import { RoutineForm } from './RoutineForm'
import { RoutineList } from './RoutineList'

const LENGTHS = [15, 30, 45, 60, 90] as const

interface Props {
  settingsRepo: SettingsRepository
  routineRepo: RoutineRepository
  /** Today, for "Add to today". */
  day: Date
  todayTasks: Task[]
  /** Adds a task to today's list; resolves true when saved. */
  addToToday: (draft: TaskDraft) => Promise<boolean>
  onBack: () => void
  /** Tells the day view the new settings (e.g. the default length for the + form). */
  onSettingsSaved?: (settings: Settings) => void
}

/** Setup: the Teams nudge switches, the default task length, and routines. */
export function SetupView({ settingsRepo, routineRepo, day, todayTasks, addToToday, onBack, onSettingsSaved }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [failed, setFailed] = useState<Settings | null>(null)
  const [routines, setRoutines] = useState<Routine[]>([])
  const [routineError, setRoutineError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Routine | 'new' | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())

  useEffect(() => {
    let live = true
    void settingsRepo.get().then((s) => live && setSettings(s))
    void routineRepo.list().then(
      (rs) => live && setRoutines(rs),
      () => live && setRoutineError("Couldn't load your routines."),
    )
    return () => {
      live = false
    }
  }, [settingsRepo, routineRepo])

  /** Runs a routine change, then reloads the list; shows an error instead of losing it silently. */
  async function changeRoutines(action: () => Promise<unknown>, failure: string): Promise<boolean> {
    setRoutineError(null)
    try {
      await action()
      setRoutines(await routineRepo.list())
      return true
    } catch {
      setRoutineError(failure)
      return false
    }
  }

  async function submitRoutine(draft: RoutineDraft): Promise<boolean> {
    const current = editing
    const ok = await changeRoutines(
      () => (current && current !== 'new' ? routineRepo.update({ ...draft, id: current.id, active: current.active }) : routineRepo.create(draft)),
      "Couldn't save the routine.",
    )
    if (ok) setEditing(null)
    return ok
  }

  async function addRoutineToToday(r: Routine) {
    if (await addToToday(routineToDraft(r, day))) setAdded((s) => new Set(s).add(r.id))
  }

  async function save(next: Settings) {
    const before = settings
    setSettings(next)
    setStatus('idle')
    try {
      await settingsRepo.save(next)
      setFailed(null)
      setStatus('saved')
      onSettingsSaved?.(next)
    } catch {
      // Show what is really stored, and keep the change for Retry.
      setSettings(before)
      setFailed(next)
      setStatus('error')
    }
  }

  return (
    <section className="setup" aria-label="Setup">
      <div className="setup-header">
        <h2>Setup</h2>
        <button onClick={onBack}>Back</button>
      </div>

      <NeuSurface className="setup-section">
        <h3>Nudges and defaults</h3>
        {status === 'error' && failed && (
          <div className="banner banner-error" role="alert">
            Couldn't save your settings. <button onClick={() => void save(failed)}>Retry</button>
          </div>
        )}
        {status === 'saved' && (
          <p className="setup-saved" role="status">
            Saved
          </p>
        )}
        {settings && (
          <>
            <div className="setup-row">
              <span>Start cards in Teams</span>
              <Switch label="Start cards in Teams" checked={settings.startNudges} onChange={(on) => void save({ ...settings, startNudges: on })} />
            </div>
            <div className="setup-row">
              <span>Stop cards in Teams</span>
              <Switch label="Stop cards in Teams" checked={settings.endNudges} onChange={(on) => void save({ ...settings, endNudges: on })} />
            </div>
            <div className="setup-row setup-lengths">
              <span>New task length</span>
              <div role="group" aria-label="New task length">
                {LENGTHS.map((min) => (
                  <button
                    key={min}
                    aria-pressed={settings.defaultLengthMin === min}
                    onClick={() => void save({ ...settings, defaultLengthMin: min })}
                  >
                    {min} min
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </NeuSurface>

      <NeuSurface className="setup-section">
        <div className="setup-row">
          <h3>Routines</h3>
          <button className="primary" onClick={() => setEditing('new')}>
            New routine
          </button>
        </div>
        {routineError && (
          <div className="banner banner-error" role="alert">
            {routineError}
          </div>
        )}
        <RoutineList
          routines={routines}
          addState={(r) => (added.has(r.id) ? 'added' : isOnDay(r, day, todayTasks) ? 'on-today' : undefined)}
          onToggleActive={(r, active) => void changeRoutines(() => routineRepo.update({ ...r, active }), "Couldn't save the routine.")}
          onAddToToday={(r) => void addRoutineToToday(r)}
          onEdit={(r) => setEditing(r)}
          onDelete={(r) => {
            if (window.confirm(`Delete "${r.title}"? It goes to the SharePoint recycle bin.`)) {
              void changeRoutines(() => routineRepo.remove(r.id), "Couldn't delete the routine.")
            }
          }}
        />
      </NeuSurface>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing && editing !== 'new' ? 'Edit routine' : 'New routine'}>
        <RoutineForm
          key={editing && editing !== 'new' ? editing.id : 'new'}
          initial={editing && editing !== 'new' ? editing : undefined}
          onSubmit={submitRoutine}
          onCancel={() => setEditing(null)}
        />
      </Sheet>
    </section>
  )
}
