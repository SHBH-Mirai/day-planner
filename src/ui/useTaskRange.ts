import { useCallback, useEffect, useState } from 'react'
import type { Task } from '../domain/task'
import type { TaskRepository } from '../storage/TaskRepository'

/** Loads the tasks of `days` days from `from` (read-only), with a Retry after a failed load. */
export function useTaskRange(repo: TaskRepository, from: Date, days: number) {
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [failed, setFailed] = useState(false)
  const fromKey = from.toDateString()
  const fetchTasks = useCallback(() => repo.listRange(new Date(fromKey), days), [repo, fromKey, days])

  useEffect(() => {
    let live = true
    fetchTasks().then(
      (loaded) => {
        if (!live) return
        setTasks(loaded)
        setFailed(false)
      },
      () => {
        if (live) setFailed(true)
      },
    )
    return () => {
      live = false
    }
  }, [fetchTasks])

  const retry = useCallback(async (): Promise<void> => {
    setFailed(false)
    try {
      setTasks(await fetchTasks())
    } catch {
      setFailed(true)
    }
  }, [fetchTasks])

  return { tasks, failed, retry }
}
