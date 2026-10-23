import type { Task, TaskDraft } from '../domain/task'
import { rangeBounds, tasksForDay } from '../domain/time'
import { RepositoryError, type TaskRepository } from './TaskRepository'

/** Keeps tasks in memory. Used by tests and by `VITE_STORAGE=memory`. */
export class InMemoryTaskRepository implements TaskRepository {
  private tasks = new Map<string, Task>()

  async listForDay(day: Date): Promise<Task[]> {
    return tasksForDay([...this.tasks.values()], day).map((t) => ({ ...t }))
  }

  async listRange(from: Date, days: number): Promise<Task[]> {
    const { fromUtc, toUtc } = rangeBounds(from, days)
    const [lo, hi] = [Date.parse(fromUtc), Date.parse(toUtc)]
    return [...this.tasks.values()]
      .filter((t) => Date.parse(t.start) >= lo && Date.parse(t.start) < hi)
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
      .map((t) => ({ ...t }))
  }

  async create(draft: TaskDraft): Promise<Task> {
    const task: Task = { ...draft, id: crypto.randomUUID(), originalEnd: draft.end, status: 'planned' }
    this.tasks.set(task.id, task)
    return { ...task }
  }

  async update(task: Task): Promise<Task> {
    if (!this.tasks.has(task.id)) throw new RepositoryError('notFound', `No task ${task.id}`)
    this.tasks.set(task.id, { ...task })
    return { ...task }
  }

  async remove(id: string): Promise<void> {
    if (!this.tasks.delete(id)) throw new RepositoryError('notFound', `No task ${id}`)
  }
}
