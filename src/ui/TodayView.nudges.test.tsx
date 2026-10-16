import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TodayView } from './TodayView'
import { InMemoryTaskRepository } from '../storage/InMemoryTaskRepository'
import { ist } from '../test-utils/makeTask'

const D = '2026-10-17'
const DAY = new Date('2026-10-17T12:00:00+05:30')

describe('TodayView nudges', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(ist(D, '09:59')))
  })
  afterEach(() => vi.useRealTimers())

  async function setup() {
    const repo = new InMemoryTaskRepository()
    await repo.create({ title: 'Deep work', start: ist(D, '09:00'), end: ist(D, '10:00'), category: 'office' })
    await repo.create({ title: 'Lunch', start: ist(D, '10:00'), end: ist(D, '10:30'), category: 'office' })
    render(<TodayView repo={repo} day={DAY} />)
    await screen.findByRole('article', { name: 'Deep work' })
    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })
    return repo
  }

  test('the STOP nudge appears when a task ends', async () => {
    await setup()
    expect(await screen.findByText('⏹ STOP: Deep work. Done?')).toBeInTheDocument()
  })

  test('Done in the nudge marks the task done and clears the nudge', async () => {
    const repo = await setup()
    const nudge = (await screen.findByText('⏹ STOP: Deep work. Done?')).closest('[role="status"]') as HTMLElement
    await userEvent.click(within(nudge).getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(screen.queryByText('⏹ STOP: Deep work. Done?')).not.toBeInTheDocument())
    const saved = (await repo.listForDay(DAY)).find((t) => t.title === 'Deep work')
    expect(saved?.status).toBe('done')
  })

  test('+15 min extends the task and shows what it pushes back', async () => {
    const repo = await setup()
    const nudge = (await screen.findByText('⏹ STOP: Deep work. Done?')).closest('[role="status"]') as HTMLElement
    await userEvent.click(within(nudge).getByRole('button', { name: '+15 min' }))
    expect(await screen.findByText('Extended to 10:15. Pushes back: Lunch')).toBeInTheDocument()
    await waitFor(async () => {
      const saved = (await repo.listForDay(DAY)).find((t) => t.title === 'Deep work')
      expect(saved).toMatchObject({ end: ist(D, '10:15'), originalEnd: ist(D, '10:00') })
    })
  })
})
