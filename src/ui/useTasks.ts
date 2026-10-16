import { useCallback, useEffect, useRef, useState } from 'react'
import type { Task, TaskDraft } from '../domain/task'
import { tasksForDay } from '../domain/time'
import type { TaskRepository } from '../storage/TaskRepository'

const byStart = (a: Task, b: Task) => Date.parse(a.start) - Date.parse(b.start)

/** One save that failed and can be retried. */
interface PendingSave {
  id: number
  run: () => Promise<void>
}

/**
 * Loads one day's tasks and saves changes. Edits and deletes show on screen
 * straight away; a failed save stays queued (and the banner stays up) until a
 * retry succeeds, so a later successful save can never hide it.
 */
export function useTasks(repo: TaskRepository, day: Date) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loadFailed, setLoadFailed] = useState(false)
  const [pending, setPending] = useState<PendingSave[]>([])
  /** Goes up on every successful create, so the add form can reset itself. */
  const [createdCount, setCreatedCount] = useState(0)
  const nextId = useRef(0)
  const dayKey = day.toDateString()

  const load = useCallback(async (): Promise<void> => {
    try {
      setTasks(await repo.listForDay(new Date(dayKey)))
      setLoadFailed(false)
    } catch {
      setLoadFailed(true)
    }
  }, [repo, dayKey])

  useEffect(() => {
    // Ignore a slow answer for a day we've already moved away from (e.g. after midnight).
    let cancelled = false
    repo.listForDay(new Date(dayKey)).then(
      (loaded) => {
        if (cancelled) return
        setTasks(loaded)
        setLoadFailed(false)
      },
      () => {
        if (!cancelled) setLoadFailed(true)
      },
    )
    return () => {
      cancelled = true
    }
  }, [repo, dayKey])

  async function attempt(run: () => Promise<void>, id = ++nextId.current): Promise<boolean> {
    try {
      await run()
      setPending((p) => p.filter((x) => x.id !== id))
      return true
    } catch {
      setPending((p) => (p.some((x) => x.id === id) ? p : [...p, { id, run }]))
      return false
    }
  }

  const add = (draft: TaskDraft) =>
    attempt(async () => {
      const created = await repo.create(draft)
      // A task dated another day is saved but doesn't belong in this day's list.
      if (tasksForDay([created], new Date(dayKey)).length > 0) setTasks((prev) => [...prev, created].sort(byStart))
      setCreatedCount((n) => n + 1)
    })

  const save = (task: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)).sort(byStart))
    return attempt(async () => {
      await repo.update(task)
    })
  }

  const remove = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    return attempt(() => repo.remove(id))
  }

  const retry = () => {
    if (loadFailed) void load()
    for (const p of pending) void attempt(p.run, p.id)
  }

  const error = loadFailed
    ? "Couldn't load your tasks."
    : pending.length > 1
      ? `Couldn't save ${pending.length} changes.`
      : pending.length === 1
        ? "Couldn't save."
        : null

  return { tasks, error, retry, add, save, remove, createdCount, reload: load }
}
