import { WEEKDAYS, type Routine, type RoutineDraft, type Weekday } from '../domain/routine'
import { CATEGORIES, type Category } from '../domain/task'

/** A Templates list item as Graph returns it with $expand=fields. */
export interface RoutineItem {
  id: string
  fields: { Title?: unknown; Category?: unknown; StartTime?: unknown; DurationMin?: unknown; Days?: unknown; Active?: unknown }
}

/** Routine → Templates columns. Days is a multi-choice column, so Graph needs its collection type. */
export function toRoutineFields(r: RoutineDraft) {
  return {
    Title: r.title,
    Category: r.category,
    StartTime: r.startTime,
    DurationMin: r.durationMin,
    'Days@odata.type': 'Collection(Edm.String)',
    Days: r.days,
    Active: r.active,
  }
}

/** Templates item → Routine, tolerating gaps left by hand edits in SharePoint. */
export function fromRoutineItem(item: RoutineItem): Routine {
  const f = item.fields
  const days = Array.isArray(f.Days) ? f.Days : []
  return {
    id: item.id,
    title: typeof f.Title === 'string' ? f.Title : '',
    category: CATEGORIES.includes(f.Category as Category) ? (f.Category as Category) : 'office',
    startTime: typeof f.StartTime === 'string' ? f.StartTime : '',
    durationMin: typeof f.DurationMin === 'number' ? f.DurationMin : 0,
    days: WEEKDAYS.filter((d: Weekday) => days.includes(d)),
    active: typeof f.Active === 'boolean' ? f.Active : true,
  }
}
