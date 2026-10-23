export type Category = 'office' | 'projects' | 'youtube' | 'recording' | 'editing' | 'learning' | 'health' | 'personal' | 'breaks'
export type Status = 'planned' | 'done' | 'skipped'

/** One planned block of time. All times are ISO 8601 UTC strings. */
export interface Task {
  id: string
  title: string
  start: string
  /** Moves when the task is extended. */
  end: string
  /** End as planned. +30 never moves it; it only follows when an edit moves start or end (a re-plan). */
  originalEnd: string
  actualStart?: string
  actualEnd?: string
  category: Category
  status: Status
  /** Plain text shown wherever a nudge shows. Absent when there is none. */
  description?: string
}

/** What the form collects before the task exists. */
export type TaskDraft = Pick<Task, 'title' | 'start' | 'end' | 'category'> & { description?: string }

/** Every category, in the order pickers, summaries and legends show them. `youtube` is stored for Content. */
export const CATEGORIES: readonly Category[] = ['office', 'projects', 'youtube', 'recording', 'editing', 'learning', 'health', 'personal', 'breaks']

/** Minutes per category, all at 0. */
export function emptyPerCategory(): Record<Category, number> {
  return Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>
}

/** A stored category value as a Category: anything unknown (a hand edit in SharePoint) reads as office. */
export function readCategory(raw: unknown): Category {
  if (typeof raw !== 'string') return 'office'
  return (CATEGORIES as readonly string[]).includes(raw) ? (raw as Category) : 'office'
}

export const MAX_DESCRIPTION = 500
export const DESCRIPTION_TOO_LONG = `Keep the description under ${MAX_DESCRIPTION} characters`

/** Trimmed description, or undefined when it's blank. */
export function normaliseDescription(text: string | undefined): string | undefined {
  const trimmed = text?.trim()
  return trimmed ? trimmed : undefined
}

/** True when the description is over the limit once trimmed. */
export function descriptionTooLong(text: string | undefined): boolean {
  return (normaliseDescription(text)?.length ?? 0) > MAX_DESCRIPTION
}
