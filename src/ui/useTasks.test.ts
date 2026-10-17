import { describe, expect, test, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useTasks } from './useTasks'
import type { Task, TaskDraft } from '../domain/task'
import { InMemoryTaskRepository } from '../storage/InMemoryTaskRepository'
import { ist } from '../test-utils/makeTask'

const D = '2026-10-17'
const DAY = new Date('2026-10-17T12:00:00+05:30')
const offline = () => new Error('offline')

/** Lets saves started without being awaited (Retry) finish. */
const settle = () => act(() => new Promise((r) => setTimeout(r, 0)))

/** A save that answers only when the test says so. */
function held<T = Task>() {
  let resolve!: (t: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** A repo with one saved task, and the hook showing its day. */
async function withOneTask() {
  const repo = new InMemoryTaskRepository()
  const task = await repo.create({ title: 'Standup', start: ist(D, '09:00'), end: ist(D, '09:15'), category: 'office' })
  const hook = renderHook(() => useTasks(repo, DAY))
  await waitFor(() => expect(hook.result.current.tasks).toHaveLength(1))
  const stored = async () => (await repo.listForDay(DAY)).find((t) => t.id === task.id)
  return { repo, task, hook, stored }
}

describe('useTasks pending saves', () => {
  test('a newer successful save of the same task drops the older failed one, so Retry cannot overwrite it', async () => {
    const { repo, task, hook, stored } = await withOneTask()
    const realUpdate = repo.update.bind(repo)
    vi.spyOn(repo, 'update').mockRejectedValueOnce(offline()).mockImplementation(realUpdate)
    await act(() => hook.result.current.save({ ...task, title: 'Old' }))
    await act(() => hook.result.current.save({ ...task, title: 'New' }))
    expect(hook.result.current.error).toBeNull()
    act(() => hook.result.current.retry())
    await settle()
    expect((await stored())?.title).toBe('New')
  })

  test('when the newer save fails too, only the newest is queued and Retry saves it', async () => {
    const { repo, task, hook, stored } = await withOneTask()
    const realUpdate = repo.update.bind(repo)
    vi.spyOn(repo, 'update').mockRejectedValueOnce(offline()).mockRejectedValueOnce(offline()).mockImplementation(realUpdate)
    await act(() => hook.result.current.save({ ...task, title: 'Old' }))
    await act(() => hook.result.current.save({ ...task, title: 'New' }))
    expect(hook.result.current.error).toBe("Couldn't save.")
    act(() => hook.result.current.retry())
    await settle()
    expect(hook.result.current.error).toBeNull()
    expect((await stored())?.title).toBe('New')
  })

  test('a Retry of the older save that fails after the newer save succeeded is not queued again', async () => {
    const { repo, task, hook, stored } = await withOneTask()
    const retried = held()
    const realUpdate = repo.update.bind(repo)
    vi.spyOn(repo, 'update').mockRejectedValueOnce(offline()).mockReturnValueOnce(retried.promise).mockImplementation(realUpdate)
    await act(() => hook.result.current.save({ ...task, title: 'Old' }))
    act(() => hook.result.current.retry())
    // Saves of one task go one at a time, so the newer save waits for the Retry to answer.
    let saving!: Promise<boolean>
    act(() => {
      saving = hook.result.current.save({ ...task, title: 'New' })
    })
    retried.reject(offline())
    await act(() => saving)
    await settle()
    expect(hook.result.current.error).toBeNull()
    expect((await stored())?.title).toBe('New')
  })

  test('a Retry of the older save that succeeds after the newer save failed keeps the newer one queued', async () => {
    const { repo, task, hook, stored } = await withOneTask()
    const retried = held()
    const realUpdate = repo.update.bind(repo)
    vi.spyOn(repo, 'update')
      .mockRejectedValueOnce(offline())
      .mockReturnValueOnce(retried.promise)
      .mockRejectedValueOnce(offline())
      .mockImplementation(realUpdate)
    await act(() => hook.result.current.save({ ...task, title: 'Old' }))
    act(() => hook.result.current.retry())
    // Saves of one task go one at a time, so the newer save waits for the Retry to answer.
    let saving!: Promise<boolean>
    act(() => {
      saving = hook.result.current.save({ ...task, title: 'New' })
    })
    retried.resolve({ ...task, title: 'Old' })
    await act(() => saving)
    await settle()
    expect(hook.result.current.error).toBe("Couldn't save.")
    act(() => hook.result.current.retry())
    await settle()
    expect((await stored())?.title).toBe('New')
  })

  test('Retry does not resend the older save while a newer save of the same task is on its way', async () => {
    const { repo, task, hook, stored } = await withOneTask()
    const slow = held<void>()
    const realUpdate = repo.update.bind(repo)
    // Every save after the failed one waits for the line, then lands in the order it was sent.
    vi.spyOn(repo, 'update')
      .mockRejectedValueOnce(offline())
      .mockImplementation(async (t) => {
        await slow.promise
        return realUpdate(t)
      })
    await act(() => hook.result.current.save({ ...task, title: 'Old' }))
    let saving!: Promise<boolean>
    act(() => {
      saving = hook.result.current.save({ ...task, title: 'New' })
    })
    act(() => hook.result.current.retry())
    slow.resolve()
    await act(() => saving)
    await settle()
    expect((await stored())?.title).toBe('New')
    expect(hook.result.current.error).toBeNull()
  })

  test('pressing Retry twice before the first answers saves a new task once', async () => {
    const repo = new InMemoryTaskRepository()
    const hook = renderHook(() => useTasks(repo, DAY))
    await settle()
    const slow = held<void>()
    const realCreate = repo.create.bind(repo)
    vi.spyOn(repo, 'create')
      .mockRejectedValueOnce(offline())
      .mockImplementation(async (d) => {
        await slow.promise
        return realCreate(d)
      })
    const draft: TaskDraft = { title: 'Gym', start: ist(D, '18:00'), end: ist(D, '19:00'), category: 'office' }
    await act(() => hook.result.current.add(draft))
    act(() => hook.result.current.retry())
    act(() => hook.result.current.retry())
    slow.resolve()
    await settle()
    expect(await repo.listForDay(DAY)).toHaveLength(1)
    expect(hook.result.current.error).toBeNull()
  })

  test('deleting a task drops its failed save', async () => {
    const { repo, task, hook, stored } = await withOneTask()
    vi.spyOn(repo, 'update').mockRejectedValueOnce(offline())
    await act(() => hook.result.current.save({ ...task, title: 'Old' }))
    await act(() => hook.result.current.remove(task.id))
    expect(hook.result.current.error).toBeNull()
    expect(await stored()).toBeUndefined()
  })

  test('a failed add that fails again on Retry stays queued once, so it is saved once', async () => {
    const repo = new InMemoryTaskRepository()
    const hook = renderHook(() => useTasks(repo, DAY))
    await settle()
    const realCreate = repo.create.bind(repo)
    vi.spyOn(repo, 'create').mockRejectedValueOnce(offline()).mockRejectedValueOnce(offline()).mockImplementation(realCreate)
    const draft: TaskDraft = { title: 'Gym', start: ist(D, '18:00'), end: ist(D, '19:00'), category: 'office' }
    await act(() => hook.result.current.add(draft))
    act(() => hook.result.current.retry())
    await settle()
    expect(hook.result.current.error).toBe("Couldn't save.")
    act(() => hook.result.current.retry())
    await settle()
    expect(hook.result.current.error).toBeNull()
    expect(await repo.listForDay(DAY)).toHaveLength(1)
  })
})

describe('useTasks saves one at a time per task', () => {
  test('a second save waits for the first, so a slow first save can never land last', async () => {
    const { repo, task, hook, stored } = await withOneTask()
    const realUpdate = repo.update.bind(repo)
    const first = held<Task>()
    const sent: string[] = []
    vi.spyOn(repo, 'update').mockImplementation(async (t) => {
      sent.push(t.title)
      if (t.title === 'Old') {
        await first.promise
      }
      return realUpdate(t)
    })

    let a!: Promise<boolean>
    let b!: Promise<boolean>
    act(() => {
      a = hook.result.current.save({ ...task, title: 'Old' })
    })
    act(() => {
      b = hook.result.current.save({ ...task, title: 'New' })
    })
    await settle()
    expect(sent).toEqual(['Old'])

    first.resolve(task)
    await act(async () => {
      await Promise.all([a, b])
    })
    expect(sent).toEqual(['Old', 'New'])
    expect((await stored())?.title).toBe('New')
  })

  test('saves that pile up behind a slow one collapse into the newest', async () => {
    const { repo, task, hook, stored } = await withOneTask()
    const realUpdate = repo.update.bind(repo)
    const first = held<Task>()
    const sent: string[] = []
    vi.spyOn(repo, 'update').mockImplementation(async (t) => {
      sent.push(t.title)
      if (t.title === 'One') await first.promise
      return realUpdate(t)
    })

    const results: Promise<boolean>[] = []
    for (const title of ['One', 'Two', 'Three']) {
      act(() => {
        results.push(hook.result.current.save({ ...task, title }))
      })
    }
    first.resolve(task)
    let oks: boolean[] = []
    await act(async () => {
      oks = await Promise.all(results)
    })
    expect(sent).toEqual(['One', 'Three'])
    expect(oks).toEqual([true, true, true])
    expect((await stored())?.title).toBe('Three')
    expect(hook.result.current.error).toBeNull()
  })

  test('a delete waits for a save of the same task that is on its way', async () => {
    const { repo, task, hook, stored } = await withOneTask()
    const realUpdate = repo.update.bind(repo)
    const first = held<Task>()
    vi.spyOn(repo, 'update').mockImplementation(async (t) => {
      await first.promise
      return realUpdate(t)
    })
    const removeSpy = vi.spyOn(repo, 'remove')

    let a!: Promise<boolean>
    let b!: Promise<boolean>
    act(() => {
      a = hook.result.current.save({ ...task, title: 'Renamed' })
    })
    act(() => {
      b = hook.result.current.remove(task.id)
    })
    await settle()
    expect(removeSpy).not.toHaveBeenCalled()

    first.resolve(task)
    await act(async () => {
      await Promise.all([a, b])
    })
    expect(removeSpy).toHaveBeenCalledTimes(1)
    expect(await stored()).toBeUndefined()
  })
})
