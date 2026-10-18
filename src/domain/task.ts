export type Category = 'office' | 'freelance' | 'youtube'
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
}

/** What the form collects before the task exists. */
export type TaskDraft = Pick<Task, 'title' | 'start' | 'end' | 'category'>

export const CATEGORIES: readonly Category[] = ['office', 'freelance', 'youtube']
