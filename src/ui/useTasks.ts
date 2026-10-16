import { useCallback, useEffect, useState } from 'react'
import type { Task, TaskDraft } from '../domain/task'
import type { TaskRepository } from '../storage/TaskRepository'

const byStart = (a: Task, b: Task) => Date.parse(a.start) - Date.parse(b.start)

interface Failure {
  message: string
  retry: () => Promise<unknown>
}

/** Loads one day's tasks and saves changes. Failed saves keep a retry. */
export function useTasks(repo: TaskRepository, day: Date) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [failure, setFailure] = useState<Failure | null>(null)
  /** Goes up on every successful create, so the add form can reset itself. */
  const [createdCount, setCreatedCount] = useState(0)
  const dayKey = day.toDateString()

  const load = useCallback(async (): Promise<void> => {
    try {
      setTasks(await repo.listForDay(new Date(dayKey)))
      setFailure(null)
    } catch {
      setFailure({ message: "Couldn't load your tasks.", retry: load })
    }
  }, [repo, dayKey])

  useEffect(() => {
    void load()
  }, [load])

  async function attempt(op: () => Promise<void>): Promise<boolean> {
    try {
      await op()
      setFailure(null)
      return true
    } catch {
      setFailure({ message: "Couldn't save.", retry: () => attempt(op) })
      return false
    }
  }

  const add = (draft: TaskDraft) =>
    attempt(async () => {
      const created = await repo.create(draft)
      setTasks((prev) => [...prev, created].sort(byStart))
      setCreatedCount((n) => n + 1)
    })

  const save = (task: Task) =>
    attempt(async () => {
      const saved = await repo.update(task)
      setTasks((prev) => prev.map((t) => (t.id === saved.id ? saved : t)).sort(byStart))
    })

  const remove = (id: string) =>
    attempt(async () => {
      await repo.remove(id)
      setTasks((prev) => prev.filter((t) => t.id !== id))
    })

  return { tasks, error: failure?.message ?? null, retry: () => void failure?.retry(), add, save, remove, createdCount }
}
