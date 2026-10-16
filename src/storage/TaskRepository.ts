import type { Task, TaskDraft } from '../domain/task'

/** Where tasks are saved. The app only talks to this, never to SharePoint directly. */
export interface TaskRepository {
  /** Tasks starting on `day` (local time), sorted by start. */
  listForDay(day: Date): Promise<Task[]>
  /** New task with status 'planned' and originalEnd = end. */
  create(draft: TaskDraft): Promise<Task>
  update(task: Task): Promise<Task>
  remove(id: string): Promise<void>
}

export type RepositoryErrorKind = 'network' | 'auth' | 'notFound' | 'unknown'

export class RepositoryError extends Error {
  readonly kind: RepositoryErrorKind

  constructor(kind: RepositoryErrorKind, message?: string) {
    super(message ?? kind)
    this.name = 'RepositoryError'
    this.kind = kind
  }
}
