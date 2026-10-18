import { useEffect, useState } from 'react'
import { isOnDay, routineToDraft, validateRoutine, type Routine, type RoutineDraft } from '../domain/routine'
import type { Task, TaskDraft } from '../domain/task'
import { byStartTime, type RoutineRepository } from '../storage/RoutineRepository'
import type { Settings, SettingsRepository } from '../storage/SettingsRepository'
import { NeuSurface } from './neu/NeuSurface'
import { Sheet } from './neu/Sheet'
import { Switch } from './neu/Switch'
import { RoutineForm } from './RoutineForm'
import { RoutineList, type AddState } from './RoutineList'

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
  const [loadFailed, setLoadFailed] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [failed, setFailed] = useState<Settings | null>(null)
  const [routines, setRoutines] = useState<Routine[]>([])
  const [routineError, setRoutineError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Routine | 'new' | null>(null)
  /** "Add to today" progress per routine id. */
  const [adds, setAdds] = useState<Map<string, 'adding' | 'added' | 'failed'>>(new Map())
  const setAdd = (id: string, state: 'adding' | 'added' | 'failed') => setAdds((m) => new Map(m).set(id, state))

  function loadSettings() {
    setLoadFailed(false)
    settingsRepo.get().then(setSettings, () => setLoadFailed(true))
  }

  useEffect(() => {
    let live = true
    settingsRepo.get().then(
      (s) => live && setSettings(s),
      () => live && setLoadFailed(true),
    )
    void routineRepo.list().then(
      (rs) => live && setRoutines(rs),
      () => live && setRoutineError("Couldn't load your routines."),
    )
    return () => {
      live = false
    }
  }, [settingsRepo, routineRepo])

  /**
   * Runs one routine change and applies it to the list here. Only the change itself can fail
   * the save; a refresh afterwards is best-effort, so a saved routine is never reported as failed.
   */
  async function changeRoutines(action: () => Promise<(list: Routine[]) => Routine[]>, failure: string): Promise<boolean> {
    setRoutineError(null)
    let apply: (list: Routine[]) => Routine[]
    try {
      apply = await action()
    } catch {
      setRoutineError(failure)
      return false
    }
    setRoutines((list) => apply(list).sort(byStartTime))
    routineRepo.list().then(setRoutines, () => {})
    return true
  }

  async function submitRoutine(draft: RoutineDraft): Promise<boolean> {
    const current = editing
    const ok = await changeRoutines(async () => {
      if (current && current !== 'new') {
        const saved = await routineRepo.update({ ...draft, id: current.id, active: current.active })
        return (list) => list.map((r) => (r.id === saved.id ? saved : r))
      }
      const created = await routineRepo.create(draft)
      return (list) => [...list, created]
    }, "Couldn't save the routine.")
    if (ok) setEditing(null)
    return ok
  }

  async function addRoutineToToday(r: Routine) {
    setAdd(r.id, 'adding')
    setAdd(r.id, (await addToToday(routineToDraft(r, day))) ? 'added' : 'failed')
  }

  function addState(r: Routine): AddState {
    if (validateRoutine(r).length > 0) return 'invalid'
    const progress = adds.get(r.id)
    if (progress) return progress
    return isOnDay(r, day, todayTasks) ? 'on-today' : undefined
  }

  const routineErrorBanner = routineError && (
    <div className="banner banner-error" role="alert">
      {routineError}
    </div>
  )

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
        {loadFailed && (
          <div className="banner banner-error" role="alert">
            Couldn't load your settings. <button onClick={loadSettings}>Retry</button>
          </div>
        )}
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
        {editing === null && routineErrorBanner}
        <RoutineList
          routines={routines}
          addState={addState}
          onToggleActive={(r, active) =>
            void changeRoutines(async () => {
              await routineRepo.setActive(r.id, active)
              return (list) => list.map((x) => (x.id === r.id ? { ...x, active } : x))
            }, "Couldn't save the routine.")
          }
          onAddToToday={(r) => void addRoutineToToday(r)}
          onEdit={(r) => setEditing(r)}
          onDelete={(r) =>
            void changeRoutines(async () => {
              await routineRepo.remove(r.id)
              return (list) => list.filter((x) => x.id !== r.id)
            }, "Couldn't delete the routine.")
          }
        />
      </NeuSurface>

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing && editing !== 'new' ? 'Edit routine' : 'New routine'}>
        {routineErrorBanner}
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
