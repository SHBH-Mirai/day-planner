import type { Task } from '../domain/task'
import { dueNudges, MISSED_AFTER_MS, type Nudge } from './dueNudges'

const STORAGE_KEY = 'dp.fired'

interface Options {
  /** Called on every tick, so it always sees the latest tasks. */
  getTasks: () => Task[]
  onNudge: (nudge: Nudge) => void
  tickMs?: number
  /** Remembers fired nudges across a refresh. Defaults to sessionStorage. */
  storage?: Storage
}

function readFired(storage: Storage): Set<string> {
  try {
    return new Set(JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

/**
 * Checks the clock every tick instead of trusting one long timer, so a
 * throttled background tab or a sleeping laptop still catches up.
 * Returns stop().
 */
export function startScheduler({ getTasks, onNudge, tickMs = 15_000, storage = sessionStorage }: Options): () => void {
  const fired = readFired(storage)
  const notBefore = new Date(Date.now() - MISSED_AFTER_MS)

  function tick() {
    const due = dueNudges(getTasks(), new Date(), fired, notBefore)
    if (due.length === 0) return
    for (const nudge of due) {
      fired.add(nudge.key)
      onNudge(nudge)
    }
    storage.setItem(STORAGE_KEY, JSON.stringify([...fired]))
  }

  tick()
  const id = setInterval(tick, tickMs)
  return () => clearInterval(id)
}
