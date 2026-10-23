import { useCallback, useEffect, useRef, useState } from 'react'
import type { Task } from '../domain/task'
import type { TaskRepository } from '../storage/TaskRepository'

/** Loads the tasks of `days` days from `from` (read-only), with a Retry after a failed load. */
export function useTaskRange(repo: TaskRepository, from: Date, days: number) {
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [failed, setFailed] = useState(false)
  /** Only the newest request may write, so an older one that answers late (a retry, a new day) is ignored. */
  const latest = useRef(0)
  const fromMs = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime()

  const request = useCallback(
    (onStart?: () => void) => {
      const id = ++latest.current
      onStart?.()
      repo.listRange(new Date(fromMs), days).then(
        (loaded) => {
          if (id !== latest.current) return
          setTasks(loaded)
          setFailed(false)
        },
        () => {
          if (id === latest.current) setFailed(true)
        },
      )
    },
    [repo, fromMs, days],
  )

  useEffect(() => {
    const requests = latest
    request()
    // Leaving (or a new range) makes any answer still on its way stale.
    return () => {
      requests.current++
    }
  }, [request])

  const retry = useCallback(() => request(() => setFailed(false)), [request])

  return { tasks, failed, retry }
}
