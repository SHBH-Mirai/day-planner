/** The planner settings the app manages; the flows read the same values. */
export interface Settings {
  /** Teams START cards on or off. */
  startNudges: boolean
  /** Teams STOP cards on or off. */
  endNudges: boolean
  /** Length of a new task from the + form, in minutes. */
  defaultLengthMin: number
}

export const DEFAULT_SETTINGS: Settings = { startNudges: true, endNudges: true, defaultLengthMin: 30 }

/** Where the one settings row lives. */
export interface SettingsRepository {
  /** The saved settings, or the defaults when there are none yet. */
  get(): Promise<Settings>
  save(settings: Settings): Promise<void>
}
