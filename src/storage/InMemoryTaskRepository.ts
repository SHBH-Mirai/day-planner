import type { Task, TaskDraft } from '../domain/task'
import { tasksForDay } from '../domain/time'
import { RepositoryError, type TaskRepository } from './TaskRepository'

/** Keeps tasks in memory. Used by tests and by `VITE_STORAGE=memory`. */
export class InMemoryTaskRepository implements TaskRepository {
  private tasks = new Map<string, Task>()

  async listForDay(day: Date): Promise<Task[]> {
    return tasksForDay([...this.tasks.values()], day).map((t) => ({ ...t }))
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
