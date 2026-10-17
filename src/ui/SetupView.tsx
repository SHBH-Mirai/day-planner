import { useEffect, useState } from 'react'
import type { Task, TaskDraft } from '../domain/task'
import type { RoutineRepository } from '../storage/RoutineRepository'
import type { Settings, SettingsRepository } from '../storage/SettingsRepository'
import { NeuSurface } from './neu/NeuSurface'
import { Switch } from './neu/Switch'

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
export function SetupView({ settingsRepo, onBack, onSettingsSaved }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [failed, setFailed] = useState<Settings | null>(null)

  useEffect(() => {
    let live = true
    void settingsRepo.get().then((s) => live && setSettings(s))
    return () => {
      live = false
    }
  }, [settingsRepo])

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
    </section>
  )
}
