import { DEFAULT_SETTINGS, type Settings, type SettingsRepository } from './SettingsRepository'

/** Settings kept in memory (tests and memory mode). */
export class InMemorySettingsRepository implements SettingsRepository {
  private settings: Settings = { ...DEFAULT_SETTINGS }

  async get(): Promise<Settings> {
    return { ...this.settings }
  }

  async save(settings: Settings): Promise<void> {
    this.settings = { ...settings }
  }
}
