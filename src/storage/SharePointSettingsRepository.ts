import { graphList, type GraphList, type GraphListOptions } from './graphRequest'
import { DEFAULT_SETTINGS, type Settings, type SettingsRepository } from './SettingsRepository'

interface SettingsItem {
  id: string
  fields: { StartNudges?: unknown; EndNudges?: unknown; DefaultLengthMin?: unknown }
}

const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)
const minutes = (v: unknown) => (typeof v === 'number' && v > 0 ? v : DEFAULT_SETTINGS.defaultLengthMin)

/**
 * The Settings list's first row. Only StartNudges, EndNudges and DefaultLengthMin are ever
 * written; the flows' own columns (FiredKeys, ConversationId, …) are left alone.
 */
export class SharePointSettingsRepository implements SettingsRepository {
  private readonly list: GraphList

  constructor(options: GraphListOptions) {
    this.list = graphList(options)
  }

  private async firstRow(): Promise<SettingsItem | undefined> {
    const res = await this.list.request(`${this.list.items}?$expand=fields&$top=1`)
    return ((await res.json()) as { value: SettingsItem[] }).value[0]
  }

  async get(): Promise<Settings> {
    const f = (await this.firstRow())?.fields ?? {}
    return {
      startNudges: bool(f.StartNudges, DEFAULT_SETTINGS.startNudges),
      endNudges: bool(f.EndNudges, DEFAULT_SETTINGS.endNudges),
      defaultLengthMin: minutes(f.DefaultLengthMin),
    }
  }

  async save(s: Settings): Promise<void> {
    const fields = { StartNudges: s.startNudges, EndNudges: s.endNudges, DefaultLengthMin: s.defaultLengthMin }
    const row = await this.firstRow()
    if (row) await this.list.request(`${this.list.items}/${row.id}/fields`, { method: 'PATCH', body: JSON.stringify(fields) })
    else await this.list.request(this.list.items, { method: 'POST', body: JSON.stringify({ fields: { Title: 'Settings', ...fields } }) })
  }
}
