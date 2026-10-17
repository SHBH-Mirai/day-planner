import { useCallback, useEffect, useRef, useState } from 'react'
import type { Task, TaskDraft } from '../domain/task'
import { tasksForDay } from '../domain/time'
import { RepositoryError, type TaskRepository } from '../storage/TaskRepository'

const byStart = (a: Task, b: Task) => Date.parse(a.start) - Date.parse(b.start)

/** One save that failed and can be retried. */
interface PendingSave {
  id: number
  /** What it saves: a task id, or a key of its own for a new task. One queued save per key. */
  key: string
  run: () => Promise<void>
  /** Failed because the Microsoft sign-in expired. */
  auth: boolean
}

const isAuth = (e: unknown) => e instanceof RepositoryError && e.kind === 'auth'

/**
 * Loads one day's tasks and saves changes. Edits and deletes show on screen
 * straight away; a failed save stays queued (and the banner stays up) until a
 * retry or a newer save of the same task succeeds, so a save of another task
 * can never hide it.
 */
export function useTasks(repo: TaskRepository, day: Date) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loadFailed, setLoadFailed] = useState<false | 'auth' | 'other'>(false)
  const [pending, setPending] = useState<PendingSave[]>([])
  /** Goes up on every successful create, so the add form can reset itself. */
  const [createdCount, setCreatedCount] = useState(0)
  const nextId = useRef(0)
  /** The newest save started for each key, so an older one that answers late can't queue itself again. */
  const newest = useRef(new Map<string, number>())
  /** Saves sent that haven't answered yet, so a second Retry tap doesn't send them twice. */
  const inFlight = useRef(new Set<number>())
  /** Per task: resolves when its latest queued save has finished, so the next one can go. */
  const tails = useRef(new Map<string, Promise<void>>())
  const dayKey = day.toDateString()

  const load = useCallback(async (): Promise<void> => {
    try {
      setTasks(await repo.listForDay(new Date(dayKey)))
      setLoadFailed(false)
    } catch (e) {
      setLoadFailed(isAuth(e) ? 'auth' : 'other')
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
      (e: unknown) => {
        if (!cancelled) setLoadFailed(isAuth(e) ? 'auth' : 'other')
      },
    )
    return () => {
      cancelled = true
    }
  }, [repo, dayKey])

  /**
   * Runs a save. A save sends the whole task, so a newer save of the same task carries
   * every older change: it replaces an older queued one instead of waiting behind it,
   * else Retry would send the old copy over the new one. Ids only go up, so a Retry that
   * answers after a newer save of the same task can't undo it.
   */
  async function attempt(run: () => Promise<void>, key?: string, id = ++nextId.current): Promise<boolean> {
    const k = key ?? `new-${id}`
    if (id > (newest.current.get(k) ?? 0)) newest.current.set(k, id)

    // One save at a time per task: wait for the one on its way, so a slow older save can't land last.
    inFlight.current.add(id)
    let done!: () => void
    const finished = new Promise<void>((r) => (done = r))
    const before = tails.current.get(k)
    const tail = before ? before.then(() => finished) : finished
    tails.current.set(k, tail)
    const release = () => {
      done()
      // Nothing queued behind this save: the task is free, so its next save goes at once.
      if (tails.current.get(k) === tail) tails.current.delete(k)
    }
    if (before) {
      await before
      // A newer save queued while this one waited carries every change, so this one has nothing left to send.
      if (newest.current.get(k) !== id) {
        inFlight.current.delete(id)
        release()
        return true
      }
    }

    try {
      await run()
      setPending((p) => p.filter((x) => x.key !== k || x.id > id))
      return true
    } catch (e) {
      if (newest.current.get(k) === id) setPending((p) => [...p.filter((x) => x.key !== k), { id, key: k, run, auth: isAuth(e) }])
      return false
    } finally {
      inFlight.current.delete(id)
      release()
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
    }, task.id)
  }

  const remove = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    return attempt(() => repo.remove(id), id)
  }

  const retry = () => {
    if (loadFailed) void load()
    // Skip a save still on its way, or one a newer save of the same task has replaced.
    for (const p of pending) if (!inFlight.current.has(p.id) && newest.current.get(p.key) === p.id) void attempt(p.run, p.key, p.id)
  }

  const needsSignIn = loadFailed === 'auth' || pending.some((p) => p.auth)
  const error = needsSignIn
    ? pending.length > 0
      ? `Your Microsoft sign-in expired. ${pending.length} unsaved change${pending.length > 1 ? 's' : ''} will need redoing after you sign in.`
      : 'Your Microsoft sign-in expired.'
    : loadFailed
    ? "Couldn't load your tasks."
    : pending.length > 1
      ? `Couldn't save ${pending.length} changes.`
      : pending.length === 1
        ? "Couldn't save."
        : null

  return { tasks, error, needsSignIn, retry, add, save, remove, createdCount, reload: load }
}
