import { WEEKDAYS, type Routine, type RoutineDraft, type Weekday } from '../domain/routine'
import { readCategory } from '../domain/task'

/** A Templates list item as Graph returns it with $expand=fields. */
export interface RoutineItem {
  id: string
  fields: { Title?: unknown; Category?: unknown; StartTime?: unknown; DurationMin?: unknown; Days?: unknown; Active?: unknown; Description?: unknown; Fixed?: unknown }
}

/**
 * Routine → Templates columns. Days is a multi-choice column, so Graph needs its collection type.
 * A new routine sends a description only when it has one; an update always sends it (null clears it).
 */
export function toRoutineFields(r: RoutineDraft, mode: 'create' | 'update' = 'create') {
  const fields: Record<string, unknown> = {
    Title: r.title,
    Category: r.category,
    StartTime: r.startTime,
    DurationMin: r.durationMin,
    'Days@odata.type': 'Collection(Edm.String)',
    Days: r.days,
    Active: r.active,
  }
  if (mode === 'update' || r.description) fields.Description = r.description ?? null
  if (mode === 'update' || r.fixed) fields.Fixed = r.fixed === true
  return fields
}

/** Templates item → Routine, tolerating gaps left by hand edits in SharePoint. */
export function fromRoutineItem(item: RoutineItem): Routine {
  const f = item.fields
  const days = Array.isArray(f.Days) ? f.Days : []
  return {
    id: item.id,
    title: typeof f.Title === 'string' ? f.Title : '',
    category: readCategory(f.Category),
    startTime: typeof f.StartTime === 'string' ? f.StartTime : '',
    durationMin: typeof f.DurationMin === 'number' ? f.DurationMin : 0,
    days: WEEKDAYS.filter((d: Weekday) => days.includes(d)),
    // Empty Active is off: the Morning flow's `Active eq 1` filter skips it too.
    active: f.Active === true,
    ...(typeof f.Description === 'string' && f.Description.trim() ? { description: f.Description } : {}),
    ...(f.Fixed === true ? { fixed: true } : {}),
  }
}
