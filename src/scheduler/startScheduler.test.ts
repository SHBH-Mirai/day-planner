import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { startScheduler } from './startScheduler'
import type { Task } from '../domain/task'
import { ist, makeTask } from '../test-utils/makeTask'

const D = '2026-10-17'
const TICK = 15_000

class MemoryStorage implements Storage {
  private data = new Map<string, string>()
  get length() { return this.data.size }
  clear() { this.data.clear() }
  getItem(k: string) { return this.data.get(k) ?? null }
  key(i: number) { return [...this.data.keys()][i] ?? null }
  removeItem(k: string) { this.data.delete(k) }
  setItem(k: string, v: string) { this.data.set(k, v) }
}

describe('startScheduler', () => {
  let tasks: Task[]
  let storage: MemoryStorage

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(ist(D, '08:59')))
    tasks = [makeTask({ title: 'Deep work', start: ist(D, '09:00'), end: ist(D, '10:00') })]
    storage = new MemoryStorage()
  })
  afterEach(() => vi.useRealTimers())

  test('fires the start nudge once when the clock passes start', () => {
    const onNudge = vi.fn()
    const stop = startScheduler({ getTasks: () => tasks, onNudge, storage })
    vi.advanceTimersByTime(60_000)
    expect(onNudge).toHaveBeenCalledOnce()
    expect(onNudge.mock.calls[0][0]).toMatchObject({ kind: 'start', missed: false })
    vi.advanceTimersByTime(5 * TICK)
    expect(onNudge).toHaveBeenCalledOnce()
    stop()
  })

  test('stop() ends all nudges', () => {
    const onNudge = vi.fn()
    startScheduler({ getTasks: () => tasks, onNudge, storage })()
    vi.advanceTimersByTime(2 * 60 * 60_000)
    expect(onNudge).not.toHaveBeenCalled()
  })

  test('a refresh (new scheduler, same storage) does not repeat a fired nudge', () => {
    const first = vi.fn()
    const stop = startScheduler({ getTasks: () => tasks, onNudge: first, storage })
    vi.advanceTimersByTime(60_000)
    stop()
    const second = vi.fn()
    startScheduler({ getTasks: () => tasks, onNudge: second, storage })()
    expect(first).toHaveBeenCalledOnce()
    expect(second).not.toHaveBeenCalled()
  })

  test('reads the latest tasks on every tick', () => {
    const onNudge = vi.fn()
    let current: Task[] = []
    const stop = startScheduler({ getTasks: () => current, onNudge, storage })
    vi.advanceTimersByTime(TICK)
    current = tasks
    vi.advanceTimersByTime(60_000)
    expect(onNudge).toHaveBeenCalledOnce()
    stop()
  })

  test('ignores nudges more than 10 minutes older than when it started', () => {
    vi.setSystemTime(new Date(ist(D, '15:00')))
    const onNudge = vi.fn()
    const stop = startScheduler({ getTasks: () => tasks, onNudge, storage })
    vi.advanceTimersByTime(TICK)
    expect(onNudge).not.toHaveBeenCalled()
    stop()
  })
})
